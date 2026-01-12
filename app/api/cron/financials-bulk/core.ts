import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import { upsertDatosFinancieros } from '../fmp-bulk/upsertDatosFinancieros';
import { deriveFinancialMetrics } from './deriveFinancialMetrics';
import Papa from 'papaparse';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';

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

// Helper to check if a period is mutable (should be re-processed)
function isMutablePeriod(year: number | null, period: string | null): boolean {
    // 1. Always process TTM (year/period are null for TTM bulk files)
    if (year === null || period === null) return true;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 = Jan, 2 = March

    // 2. Always process current calendar year (Qs and FY)
    if (year === currentYear) return true;

    // 3. Process previous year
    if (year === currentYear - 1) {
        // Before March 31: Previous year is considered open/mutable (Q4 results coming in, FY finalizing)
        if (currentMonth <= 2) return true;
        
        // After March 31: Previous year is closed/immutable
        return false;
    }

    // 4. Skip older years
    return false;
}

// Helper to find missing tickers in DB for a specific period
async function getMissingTickersForPeriod(
    tickers: Set<string>, 
    year: number, 
    period: string, 
    type: 'Q' | 'FY'
): Promise<Set<string>> {
    if (tickers.size === 0) return new Set();
    
    const tickerList = Array.from(tickers);
    const periodLabel = type === 'FY' ? `${year}` : `${year}${period}`;

    // Query DB for tickers that HAVE this data
    const { data, error } = await supabaseAdmin
        .from('datos_financieros')
        .select('ticker')
        .eq('period_type', type)
        .eq('period_label', periodLabel)
        .in('ticker', tickerList);

    if (error) {
        console.error(`[financials-bulk] Error checking missing tickers for ${periodLabel}:`, error);
        return tickers; // Assume all missing on error to be safe (or empty? Safe to process)
    }

    const existingTickers = new Set(data?.map(r => r.ticker) || []);
    
    // Return only those NOT in existingTickers
    const missing = new Set<string>();
    for (const t of tickerList) {
        if (!existingTickers.has(t)) {
            missing.add(t);
        }
    }
    return missing;
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

        if (!existsSync(filePath) || isMutablePeriod(year, period)) {
            const action = existsSync(filePath) ? 'REFRESH' : 'MISS';
            console.log(`[fmp-bulk-cache] ${action} ${fileName} -> downloading`);
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
            console.log(`[fmp-bulk-cache] HIT ${fileName} (Immutable & Cached)`);
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

        let targetTickers = activeTickers;
        const isMutable = isMutablePeriod(year, period);

        // GAP DETECTION LOGIC
        if (!isMutable && year !== null && period !== null) {
             const type = period === 'FY' ? 'FY' : 'Q';
             // Check which of the current batch of tickers are missing this period
             const missing = await getMissingTickersForPeriod(activeTickers, year, period, type);
             
             if (missing.size === 0) {
                 // All tickers in this batch already have this immutable period
                 // console.log(`[fmp-bulk-cache] SKIP ${fileName} (Immutable & Complete)`);
                 return [];
             }
             
             // Only process the rows for the missing tickers
             console.log(`[fmp-bulk-cache] GAP-FILL ${fileName} -> Processing ${missing.size} missing tickers`);
             targetTickers = missing;
        } else if (!isMutable) {
             // Should not be reached given isMutablePeriod logic for TTM (which is always true)
             // But purely defensive:
             return [];
        }
        // If mutable, targetTickers remains activeTickers (process all)

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
                    // Filter: Must be in our target list (either full batch or missing subset)
                    if (symbol && targetTickers.has(symbol)) {
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

async function persistFinancialsStreaming(
    activeTickers: string[], 
    data: { income: any[], balance: any[], cashflow: any[], metricsTTM: any[], ratiosTTM: any[] },
    maxBatchSize: number
) {
    const { income, balance, cashflow, metricsTTM, ratiosTTM } = data;
    
    // Index by ticker (local to this chunk)
    const incomeMap = groupByTicker(income);
    const balanceMap = groupByTicker(balance);
    const cashflowMap = groupByTicker(cashflow);
    const metricsTTMMap = groupByTicker(metricsTTM);
    const ratiosTTMMap = groupByTicker(ratiosTTM);

    let rowsBuffer: any[] = [];
    const stats = { processed: 0, skipped: 0, fy_built: 0, q_built: 0, ttm_built: 0 };

    // Flush Helper
    const flushBatch = async () => {
        if (rowsBuffer.length === 0) return;
        
        // Deduplicate rows based on unique constraints (ticker, period_type, period_label)
        const uniqueRowsMap = new Map();
        rowsBuffer.forEach(row => {
            const key = `${row.ticker}-${row.period_type}-${row.period_label}`;
            uniqueRowsMap.set(key, row);
        });
        const uniqueRows = Array.from(uniqueRowsMap.values());
        
        // Remove fcf_cagr as it's not in the database table
        const dbChunk = uniqueRows.map(({ fcf_cagr, ...row }) => row);
        
        await upsertDatosFinancieros(supabaseAdmin, dbChunk);
        
        // Sync Growth (TTM only)
        const ttmRows = uniqueRows.filter(r => r.period_type === 'TTM');
        if (ttmRows.length > 0) {
            const today = new Date().toISOString().slice(0, 10);
            // We can do this in parallel or seq.
            await Promise.all(ttmRows.map(async (row) => {
                 const growth = {
                    revenue_cagr: row.revenue_cagr,
                    earnings_cagr: row.earnings_cagr,
                    fcf_cagr: row.fcf_cagr
                };
                await supabaseAdmin.from('fintra_snapshots')
                    .update({ fundamentals_growth: growth })
                    .eq('ticker', row.ticker)
                    .eq('snapshot_date', today);
            }));
        }

        // Clear buffer
        rowsBuffer = [];
    };

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

            rowsBuffer.push({
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

            rowsBuffer.push({
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

                rowsBuffer.push({
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
      
      // Check buffer size
      if (rowsBuffer.length >= maxBatchSize) {
          await flushBatch();
      }
    }

    // Final Flush
    await flushBatch();

    return stats;
}

export async function runFinancialsBulk(targetTicker?: string, limit?: number) {
    const fmpKey = process.env.FMP_API_KEY!;
    if (!fmpKey) {
        throw new Error('Missing FMP_API_KEY');
    }

    // 1. Download & Cache (Skipped if recent & valid)
    await downloadAndCacheCSVs(fmpKey);

    // 2. Get Universe
    const allActiveTickers = await getActiveStockTickers(supabaseAdmin);
    let activeSet = new Set(allActiveTickers);

    if (targetTicker) {
        console.log(`[FinancialsBulk] Running for single ticker: ${targetTicker}`);
        if (activeSet.has(targetTicker)) {
            activeSet = new Set([targetTicker]);
        } else {
            console.warn(`[FinancialsBulk] Ticker ${targetTicker} not in active set. Processing anyway.`);
            activeSet = new Set([targetTicker]);
        }
    } else if (limit && limit > 0) {
        console.log(`🧪 BENCHMARK MODE: Limiting financials to first ${limit} tickers`);
        const limitedTickers = allActiveTickers.slice(0, limit);
        activeSet = new Set(limitedTickers);
    }

    // 3. Parse CSVs (filtered by activeSet)
    const data = await parseCachedCSVs(activeSet);
    console.log(`[FinancialsBulk] Parsed Data: Income=${data.income.length}, Balance=${data.balance.length}`);

    // 4. Process & Persist
    const tickersArray = Array.from(activeSet);
    const stats = await persistFinancialsStreaming(tickersArray, data, 500);

    return {
        ok: true,
        stats
    };
}
