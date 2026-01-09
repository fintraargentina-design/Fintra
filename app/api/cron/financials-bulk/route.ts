import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchFinancialsBulk } from './fetch';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import { upsertDatosFinancieros } from '../fmp-bulk/upsertDatosFinancieros';
import { deriveFinancialMetrics } from './deriveFinancialMetrics';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tickerParam = searchParams.get('ticker');
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

    console.log(`[financials-bulk] Processing ${activeTickers.length} tickers. Fetching bulk data (2022-2024 + TTM)...`);

    // 2. Fetch financial bulk data
    // Updated to include metricsTTM and ratiosTTM, and 3 years of history
    const { income, balance, cashflow, metricsTTM, ratiosTTM } = await fetchFinancialsBulk(fmpKey, new Set(activeTickers));
    
    console.log(`[financials-bulk] Fetched: ${income.length} Income, ${balance.length} Balance, ${cashflow.length} CF, ${metricsTTM.length} MetricsTTM, ${ratiosTTM.length} RatiosTTM rows.`);

    // Index by ticker
    const incomeMap = groupByTicker(income);
    const balanceMap = groupByTicker(balance);
    const cashflowMap = groupByTicker(cashflow);
    const metricsTTMMap = groupByTicker(metricsTTM);
    const ratiosTTMMap = groupByTicker(ratiosTTM);

    const rowsToUpsert: any[] = [];
    const stats = { processed: 0, skipped: 0, fy_built: 0, ttm_built: 0 };

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
      // We process ALL available FY rows (2022, 2023, 2024)
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

      // --- BUILD TTM (Trailing 12 Months) ---
      // Need last 4 quarters
      // Note: TTM is built from Quarterly data, but usually uses LATEST FY CAGR? 
      // Or we pass historical FY data to calculate CAGR ending at TTM date?
      // deriveFinancialMetrics uses periodEndDate to filter history.
      
      const qIncome = tickerIncome.filter(r => r.period !== 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const qBalance = tickerBalance.filter(r => r.period !== 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const qCashflow = tickerCashflow.filter(r => r.period !== 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (qIncome.length >= 4 && qCashflow.length >= 4 && qBalance.length >= 1) {
        const last4Income = qIncome.slice(0, 4);
        const last4Cashflow = qCashflow.slice(0, 4);
        const latestBalance = qBalance[0]; // Balance sheet uses point-in-time (latest)

        // Sum Income/CF items
        const ttmIncome = sumStatements(last4Income);
        const ttmCashflow = sumStatements(last4Cashflow);
        
        // Construct label from latest quarter (e.g., "2024Q3")
        const latestQ = last4Income[0];
        const labelYear = latestQ.calendarYear || latestQ.date.substring(0, 4);
        const labelPeriod = latestQ.period || 'Trailing';
        const ttmLabel = `${labelYear}${labelPeriod}`;

        const derived = deriveFinancialMetrics({
            income: ttmIncome,
            balance: latestBalance,
            cashflow: ttmCashflow,
            metricsTTM: tickerMetricsTTM, // Use TTM metrics here
            ratiosTTM: tickerRatiosTTM,
            historicalIncome: historicalIncome,
            historicalCashflow: historicalCashflow,
            historicalBalance: historicalBalance,
            periodType: 'TTM',
            periodEndDate: latestQ.date
        });

        rowsToUpsert.push({
          ticker,
          period_type: 'TTM',
          period_label: ttmLabel, 
          period_end_date: latestQ.date,
          source: 'fmp_bulk',
          ...derived
        });
        stats.ttm_built++;
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
    // FGOS reads growth from fintra_snapshots.fundamentals_growth
    // We update the current snapshot with the calculated TTM CAGR.
    const ttmRows = uniqueRows.filter(r => r.period_type === 'TTM');
    if (ttmRows.length > 0) {
        console.log(`[financials-bulk] Syncing growth metrics to today's snapshots for ${ttmRows.length} tickers...`);
        const today = new Date().toISOString().slice(0, 10);
        
        // We do this one by one or in small batches. 
        // Since it's an update, simple loop is safest for now (or Promise.all with concurrency limit).
        // Using strict sequential to avoid overwhelming DB if many.
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

    return NextResponse.json({
      message: 'Financials backfill complete (v1 Metrics Layer)',
      stats,
      sample: rowsToUpsert.slice(0, 2)
    });

  } catch (error: any) {
    console.error('[financials-bulk] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
