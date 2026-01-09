import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import { upsertDatosFinancieros } from '../fmp-bulk/upsertDatosFinancieros';
import { deriveFinancialMetrics } from './deriveFinancialMetrics';
import Papa from 'papaparse';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// --- Constants & Config ---
const BASE_URL = 'https://financialmodelingprep.com/stable';
const CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-bulk');

const ENDPOINT_MAP: Record<string, string> = {
  'income-statement-bulk': 'income',
  'balance-sheet-statement-bulk': 'balance',
  'cash-flow-statement-bulk': 'cashflow',
  'key-metrics-ttm-bulk': 'metrics_ttm',
  'ratios-ttm-bulk': 'ratios_ttm'
};

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const PERIODS = ['FY', 'Q1', 'Q2', 'Q3', 'Q4'];

// --- Helper Functions ---

// Helper to group by ticker
const groupByTicker = (rows: any[]) => {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const symbol = row.symbol || row.ticker;
    if (!symbol) continue;
    if (!map.has(symbol)) map.set(symbol, []);
    map.get(symbol)!.push(row);
  }
  return map;
};

// Helper to sum quarterly statements for TTM
function sumStatements(rows: any[]) {
  const sum: any = {};
  if (!rows.length) return sum;
  
  // Initialize with keys from first row (latest)
  Object.keys(rows[0]).forEach(k => {
    if (typeof rows[0][k] === 'number') sum[k] = 0;
    else sum[k] = rows[0][k]; // Keep text/date from first (latest)
  });

  for (const row of rows) {
    Object.keys(row).forEach(k => {
      if (typeof row[k] === 'number') {
        sum[k] = (sum[k] || 0) + row[k];
      }
    });
  }
  return sum;
}

// Helper to check if two quarters are consecutive
// qNew should be immediately after qOld
function areConsecutive(qNew: any, qOld: any): boolean {
    if (!qNew || !qOld) return false;

    // 1. Try strict Calendar Year + Period check
    if (qNew.calendarYear && qOld.calendarYear && qNew.period && qOld.period) {
        const yNew = parseInt(qNew.calendarYear);
        const yOld = parseInt(qOld.calendarYear);
        const pNew = qNew.period; // e.g. "Q1"
        const pOld = qOld.period;

        // Same year: Q2 after Q1, etc.
        if (yNew === yOld) {
            if (pNew === 'Q2' && pOld === 'Q1') return true;
            if (pNew === 'Q3' && pOld === 'Q2') return true;
            if (pNew === 'Q4' && pOld === 'Q3') return true;
        }
        // Year crossing: Q1 of Next Year after Q4 of Prev Year
        if (yNew === yOld + 1) {
            if (pNew === 'Q1' && pOld === 'Q4') return true;
        }
        
        // If strict check fails but data exists, do NOT fallback immediately? 
        // FMP sometimes has weird periods. Let's use Date as secondary confirmation or fallback.
    }

    // 2. Fallback: Date Check (approx 3 months)
    // Q ends are usually ~90 days apart. Allow 75-105 days.
    const dNew = new Date(qNew.date).getTime();
    const dOld = new Date(qOld.date).getTime();
    const diffDays = (dNew - dOld) / (1000 * 3600 * 24);

    return diffDays >= 75 && diffDays <= 105;
}

// --- Refactored Phase Functions ---

async function downloadAndCacheCSVs(apiKey: string) {
    console.log(`[financials-bulk] Starting Download Phase...`);
    
    // Ensure cache directory exists
    if (!existsSync(CACHE_DIR)) {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    }

    const fetchFile = async (endpointBase: string, year: number | null, period: string | null) => {
        const prefix = ENDPOINT_MAP[endpointBase] || endpointBase;
        const fileName = year ? `${prefix}_${year}_${period}.csv` : `${prefix}.csv`;
        const filePath = path.join(CACHE_DIR, fileName);
        
        let url = `${BASE_URL}/${endpointBase}?apikey=${apiKey}`;
        if (year && period) {
            url += `&year=${year}&period=${period}`;
        }

        if (!existsSync(filePath)) {
            console.log(`[fmp-bulk-cache] MISS ${fileName} -> downloading`);
            try {
                const res = await fetch(url);
                
                if (res.status === 429) {
                    console.error(`[fmp-bulk-cache] FETCH FAILED ${fileName} (429) - Rate Limit Exceeded`);
                    return; 
                }

                if (!res.ok) {
                    console.warn(`[fmp-bulk-cache] Failed to fetch ${url}: ${res.status} ${res.statusText}`);
                    return;
                }

                const arrayBuffer = await res.arrayBuffer();
                await fs.writeFile(filePath, Buffer.from(arrayBuffer));
            } catch (e) {
                console.error(`[fmp-bulk-cache] Error fetching ${url}:`, e);
            }
        } else {
            console.log(`[fmp-bulk-cache] HIT ${fileName}`);
        }
    };

    const tasks: Promise<void>[] = [];

    // Queue up downloads
    for (const year of YEARS) {
        for (const period of PERIODS) {
            tasks.push(fetchFile('income-statement-bulk', year, period));
            tasks.push(fetchFile('balance-sheet-statement-bulk', year, period));
            tasks.push(fetchFile('cash-flow-statement-bulk', year, period));
        }
    }

    // TTM Bulk
    tasks.push(fetchFile('key-metrics-ttm-bulk', null, null));
    tasks.push(fetchFile('ratios-ttm-bulk', null, null));

    // Execute in chunks
    const CHUNK_SIZE = 10;
    for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
        const chunk = tasks.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk);
    }
}

async function parseCachedCSVs(activeTickers: Set<string>) {
    console.log(`[financials-bulk] Starting Parse Phase...`);
    
    const parseFile = async (endpointBase: string, year: number | null, period: string | null): Promise<any[]> => {
        const prefix = ENDPOINT_MAP[endpointBase] || endpointBase;
        const fileName = year ? `${prefix}_${year}_${period}.csv` : `${prefix}.csv`;
        const filePath = path.join(CACHE_DIR, fileName);

        if (!existsSync(filePath)) {
            console.warn(`[fmp-bulk-cache] File not found: ${fileName} (skipping)`);
            return [];
        }

        return new Promise((resolve) => {
            const rows: any[] = [];
            const stream = createReadStream(filePath);
            
            Papa.parse(stream, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                step: (results: any) => {
                    const row = results.data;
                    const symbol = row.symbol || row.ticker;
                    if (symbol && activeTickers.has(symbol)) {
                        rows.push(row);
                    }
                },
                complete: () => {
                    resolve(rows);
                },
                error: (err: any) => {
                    console.error(`[fmp-bulk-cache] Error parsing ${fileName}:`, err);
                    resolve([]);
                }
            });
        });
    };

    const tasks: Promise<{ type: string, rows: any[] }>[] = [];

    for (const year of YEARS) {
        for (const period of PERIODS) {
            tasks.push(parseFile('income-statement-bulk', year, period).then(rows => ({ type: 'income', rows })));
            tasks.push(parseFile('balance-sheet-statement-bulk', year, period).then(rows => ({ type: 'balance', rows })));
            tasks.push(parseFile('cash-flow-statement-bulk', year, period).then(rows => ({ type: 'cashflow', rows })));
        }
    }

    tasks.push(parseFile('key-metrics-ttm-bulk', null, null).then(rows => ({ type: 'metrics_ttm', rows })));
    tasks.push(parseFile('ratios-ttm-bulk', null, null).then(rows => ({ type: 'ratios_ttm', rows })));

    const CHUNK_SIZE = 10;
    const results: { type: string, rows: any[] }[] = [];
    
    for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
        const chunk = tasks.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk);
        results.push(...chunkResults);
    }

    const income = results.filter(r => r.type === 'income').flatMap(r => r.rows);
    const balance = results.filter(r => r.type === 'balance').flatMap(r => r.rows);
    const cashflow = results.filter(r => r.type === 'cashflow').flatMap(r => r.rows);
    const metricsTTM = results.filter(r => r.type === 'metrics_ttm').flatMap(r => r.rows);
    const ratiosTTM = results.filter(r => r.type === 'ratios_ttm').flatMap(r => r.rows);

    return { income, balance, cashflow, metricsTTM, ratiosTTM };
}

async function persistFinancials(
    activeTickers: string[], 
    data: { income: any[], balance: any[], cashflow: any[], metricsTTM: any[], ratiosTTM: any[] }
) {
    const { income, balance, cashflow, metricsTTM, ratiosTTM } = data;
    console.log(`[financials-bulk] Processing: ${income.length} Income, ${balance.length} Balance, ${cashflow.length} CF, ${metricsTTM.length} MetricsTTM, ${ratiosTTM.length} RatiosTTM rows.`);

    // Index by ticker
    const incomeMap = groupByTicker(income);
    const balanceMap = groupByTicker(balance);
    const cashflowMap = groupByTicker(cashflow);
    const metricsTTMMap = groupByTicker(metricsTTM);
    const ratiosTTMMap = groupByTicker(ratiosTTM);

    const rowsToUpsert: any[] = [];
    const stats = { processed: 0, skipped: 0, fy_built: 0, q_built: 0, ttm_built: 0 };

    // 3. Process each ticker
    for (const ticker of activeTickers) {
      const tickerIncome = incomeMap.get(ticker) || [];
      const tickerBalance = balanceMap.get(ticker) || [];
      const tickerCashflow = cashflowMap.get(ticker) || [];
      const tickerMetricsTTM = metricsTTMMap.get(ticker)?.[0] || null; // Usually 1 row per ticker
      const tickerRatiosTTM = ratiosTTMMap.get(ticker)?.[0] || null;

      if (!tickerIncome.length && !tickerBalance.length) {
        stats.skipped++;
        continue;
      }

      stats.processed++;

      // Filter Historical FY rows (for CAGR)
      const historicalIncome = tickerIncome.filter(r => r.period === 'FY').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const historicalCashflow = tickerCashflow.filter(r => r.period === 'FY').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const historicalBalance = tickerBalance.filter(r => r.period === 'FY').sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // --- BUILD FY (Annuals) ---
      // We process ALL available FY rows
      const fyIncomes = tickerIncome.filter(r => r.period === 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      for (const inc of fyIncomes) {
          const bal = tickerBalance.find(r => r.period === 'FY' && r.date === inc.date);
          const cf = tickerCashflow.find(r => r.period === 'FY' && r.date === inc.date);

          if (bal && cf) {
            const derived = deriveFinancialMetrics({
                income: inc,
                balance: bal,
                cashflow: cf,
                // Do NOT use TTM metrics for historical FY rows
                metricsTTM: null,
                ratiosTTM: null,
                historicalIncome: historicalIncome, // Pass full history for CAGR
                historicalCashflow: historicalCashflow,
                historicalBalance: historicalBalance,
                periodType: 'FY',
                periodEndDate: inc.date
            });

            rowsToUpsert.push({
              ticker,
              period_type: 'FY',
              period_label: inc.date.slice(0, 4), // Year as label
              period_end_date: inc.date,
              source: 'fmp_bulk',
              ...derived
            });
            stats.fy_built++;
          }
      }

      // --- BUILD QUARTERS (New Step 1) ---
      const qIncome = tickerIncome.filter(r => r.period !== 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const qBalance = tickerBalance.filter(r => r.period !== 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const qCashflow = tickerCashflow.filter(r => r.period !== 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      for (const inc of qIncome) {
          const bal = qBalance.find(r => r.date === inc.date);
          const cf = qCashflow.find(r => r.date === inc.date);
          
          if (bal && cf) {
            const derived = deriveFinancialMetrics({
                income: inc,
                balance: bal,
                cashflow: cf,
                metricsTTM: null,
                ratiosTTM: null,
                historicalIncome: historicalIncome,
                historicalCashflow: historicalCashflow,
                historicalBalance: historicalBalance,
                periodType: 'Q',
                periodEndDate: inc.date
            });

            rowsToUpsert.push({
              ticker,
              period_type: 'Q',
              period_label: `${inc.calendarYear || inc.date.substring(0, 4)}${inc.period}`,
              period_end_date: inc.date,
              source: 'fmp_bulk',
              ...derived
            });
            stats.q_built++;
          }
      }

      // --- BUILD TTM (Trailing 12 Months) (Step 2) ---
      // Need last 4 CONSECUTIVE quarters
      if (qIncome.length >= 4) {
        const q1 = qIncome[0]; // Latest
        const q2 = qIncome[1];
        const q3 = qIncome[2];
        const q4 = qIncome[3];

        if (areConsecutive(q1, q2) && areConsecutive(q2, q3) && areConsecutive(q3, q4)) {
            const last4Income = [q1, q2, q3, q4];
            // Ensure CFs exist for all 4
            const last4Cashflow = last4Income.map(inc => qCashflow.find(cf => cf.date === inc.date)).filter(Boolean);
            const latestBalance = qBalance.find(b => b.date === q1.date);

            if (last4Cashflow.length === 4 && latestBalance) {
                const ttmIncome = sumStatements(last4Income);
                const ttmCashflow = sumStatements(last4Cashflow as any[]);
                
                const labelYear = q1.calendarYear || q1.date.substring(0, 4);
                const labelPeriod = q1.period; 
                const ttmLabel = `${labelYear}${labelPeriod}`;

                const derived = deriveFinancialMetrics({
                    income: ttmIncome,
                    balance: latestBalance,
                    cashflow: ttmCashflow,
                    metricsTTM: tickerMetricsTTM,
                    ratiosTTM: tickerRatiosTTM,
                    historicalIncome: historicalIncome,
                    historicalCashflow: historicalCashflow,
                    historicalBalance: historicalBalance,
                    periodType: 'TTM',
                    periodEndDate: q1.date
                });

                rowsToUpsert.push({
                  ticker,
                  period_type: 'TTM',
                  period_label: ttmLabel, 
                  period_end_date: q1.date,
                  source: 'fmp_bulk',
                  ...derived
                });
                stats.ttm_built++;
            }
        }
      }
    }

    // 4. Persist
    console.log(`[financials-bulk] Upserting ${rowsToUpsert.length} rows...`);

    // Deduplicate rows based on unique constraints (ticker, period_type, period_label)
    const uniqueRowsMap = new Map();
    rowsToUpsert.forEach(row => {
        const key = `${row.ticker}-${row.period_type}-${row.period_label}`;
        uniqueRowsMap.set(key, row);
    });
    const uniqueRows = Array.from(uniqueRowsMap.values());
    console.log(`[financials-bulk] After deduplication: ${uniqueRows.length} rows (removed ${rowsToUpsert.length - uniqueRows.length} duplicates)`);
    
    // Step 1: Initialize Progress Tracking
    const totalTickers = activeTickers.length;
    const completedTickers = new Set<string>();

    const CHUNK_SIZE = 1000;
    for (let i = 0; i < uniqueRows.length; i += CHUNK_SIZE) {
      const chunk = uniqueRows.slice(i, i + CHUNK_SIZE);
      // Remove fcf_cagr as it's not in the database table
      const dbChunk = chunk.map(({ fcf_cagr, ...row }) => row);
      await upsertDatosFinancieros(supabaseAdmin, dbChunk);

      // Step 2: Track Progress After Each Batch Upsert
      for (const row of chunk) {
        completedTickers.add(row.ticker);
      }

      const completed = completedTickers.size;
      const percent = ((completed / totalTickers) * 100).toFixed(1);

      console.log(
        `[financials-bulk] Progress: ${completed} / ${totalTickers} tickers completed (${percent}%)`
      );
    }

    // 5. Sync Growth to Snapshots (Critical for FGOS)
    const ttmRows = uniqueRows.filter(r => r.period_type === 'TTM');
    if (ttmRows.length > 0) {
        console.log(`[financials-bulk] Syncing growth metrics to today's snapshots for ${ttmRows.length} tickers...`);
        const today = new Date().toISOString().slice(0, 10);
        
        for (const row of ttmRows) {
            const growth = {
                revenue_cagr: row.revenue_cagr,
                earnings_cagr: row.earnings_cagr,
                fcf_cagr: row.fcf_cagr
            };
            
            // Fire and forget update (soft sync)
            await supabaseAdmin.from('fintra_snapshots')
                .update({ fundamentals_growth: growth })
                .eq('ticker', row.ticker)
                .eq('snapshot_date', today);
        }
    }

    return { stats, rowsToUpsert: uniqueRows };
}

// --- Main Handler ---

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tickerParam = searchParams.get('ticker');
    const mode = searchParams.get('mode') || 'full'; // download, persist, full
    const fmpKey = process.env.FMP_API_KEY;

    if (!fmpKey) return NextResponse.json({ error: 'Missing FMP_API_KEY' }, { status: 500 });

    // 1. Load active tickers
    let activeTickers = await getActiveStockTickers(supabaseAdmin);
    if (tickerParam) {
      activeTickers = activeTickers.filter(t => t === tickerParam);
      if (!activeTickers.length) {
        return NextResponse.json({ message: `Ticker ${tickerParam} not found in active list` }, { status: 404 });
      }
    }

    console.log(`[financials-bulk] Mode: ${mode}. Active Tickers: ${activeTickers.length}`);

    // Phase 1: Download
    if (mode === 'download' || mode === 'full') {
        await downloadAndCacheCSVs(fmpKey);
    }

    let stats = {};
    let sample = [];

    // Phase 2: Persist
    if (mode === 'persist' || mode === 'full') {
        const activeTickersSet = new Set(activeTickers);
        const data = await parseCachedCSVs(activeTickersSet);
        const result = await persistFinancials(activeTickers, data);
        stats = result.stats;
        sample = result.rowsToUpsert.slice(0, 2);
    }

    return NextResponse.json({
      message: `Financials bulk execution complete (mode=${mode})`,
      stats,
      sample
    });

  } catch (error: any) {
    console.error('[financials-bulk] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
