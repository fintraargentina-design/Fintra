import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchFinancialsBulk } from './fetch';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import { upsertDatosFinancieros } from '../fmp-bulk/upsertDatosFinancieros';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// Helper to safe divide
const div = (n: number | undefined | null, d: number | undefined | null) => {
  if (!n || !d || d === 0) return null;
  return n / d;
};

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

    console.log(`[financials-bulk] Processing ${activeTickers.length} tickers. Fetching bulk data...`);

    // 2. Fetch financial bulk data
    const { income, balance, cashflow } = await fetchFinancialsBulk(fmpKey);
    
    console.log(`[financials-bulk] Fetched: ${income.length} Income, ${balance.length} Balance, ${cashflow.length} CF rows.`);

    // Index by ticker
    const incomeMap = groupByTicker(income);
    const balanceMap = groupByTicker(balance);
    const cashflowMap = groupByTicker(cashflow);

    const rowsToUpsert: any[] = [];
    const stats = { processed: 0, skipped: 0, fy_built: 0, ttm_built: 0 };

    // 3. Process each ticker
    for (const ticker of activeTickers) {
      const tickerIncome = incomeMap.get(ticker) || [];
      const tickerBalance = balanceMap.get(ticker) || [];
      const tickerCashflow = cashflowMap.get(ticker) || [];

      if (!tickerIncome.length && !tickerBalance.length) {
        stats.skipped++;
        continue;
      }

      stats.processed++;

      // --- BUILD FY (Latest Annual) ---
      // Filter for 'FY' period rows
      const fyIncome = tickerIncome.filter(r => r.period === 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const fyBalance = tickerBalance.filter(r => r.period === 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const fyCashflow = tickerCashflow.filter(r => r.period === 'FY').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (fyIncome && fyBalance && fyCashflow) {
        const metrics = computeMetrics(fyIncome, fyBalance, fyCashflow);
        rowsToUpsert.push({
          ticker,
          period_type: 'FY',
          period_label: fyIncome.date.slice(0, 4), // Year as label
          period_end_date: fyIncome.date,
          source: 'fmp_bulk',
          ...metrics
        });
        stats.fy_built++;
      }

      // --- BUILD TTM (Trailing 12 Months) ---
      // Need last 4 quarters
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
        
        // TTM Metrics
        const metrics = computeMetrics(ttmIncome, latestBalance, ttmCashflow);
        
        // Construct label from latest quarter (e.g., "2024Q3") to allow history
        const latestQ = last4Income[0];
        const labelYear = latestQ.calendarYear || latestQ.date.substring(0, 4);
        const labelPeriod = latestQ.period || 'Trailing';
        const ttmLabel = `${labelYear}${labelPeriod}`;

        rowsToUpsert.push({
          ticker,
          period_type: 'TTM',
          period_label: ttmLabel, 
          period_end_date: latestQ.date,
          source: 'fmp_bulk',
          ...metrics
        });
        stats.ttm_built++;
      }
    }

    // 4. Persist
    console.log(`[financials-bulk] Upserting ${rowsToUpsert.length} rows...`);
    
    // Batch upsert (Supabase limit is usually fine with ~1000s, but better chunk if huge)
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < rowsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = rowsToUpsert.slice(i, i + CHUNK_SIZE);
      await upsertDatosFinancieros(supabaseAdmin, chunk);
    }

    return NextResponse.json({
      message: 'Financials backfill complete',
      stats,
      sample: rowsToUpsert.slice(0, 2)
    });

  } catch (error: any) {
    console.error('[financials-bulk] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function sumStatements(rows: any[]) {
  const sum: any = {};
  if (!rows.length) return sum;
  
  // Initialize with keys from first row
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

function computeMetrics(inc: any, bal: any, cf: any) {
  const revenue = inc.revenue;
  const netIncome = inc.netIncome;
  const opIncome = inc.operatingIncome;
  const costOfRev = inc.costOfRevenue;
  
  const totalEquity = bal.totalStockholdersEquity;
  const totalDebt = bal.totalDebt;
  const totalAssets = bal.totalAssets; // Optional if needed for ROA
  
  const opCashFlow = cf.operatingCashFlow;
  const capex = cf.capitalExpenditure;

  // Derived
  const grossMargin = div(revenue - costOfRev, revenue);
  const operatingMargin = div(opIncome, revenue);
  const netMargin = div(netIncome, revenue);
  
  const roe = div(netIncome, totalEquity);
  // ROIC = NOPAT / Invested Capital. Proxy: Net Income / (Equity + Debt)
  const roic = div(netIncome, (totalEquity || 0) + (totalDebt || 0));
  
  const fcf = (opCashFlow || 0) - (Math.abs(capex || 0)); // Capex is often negative in FMP?
  // Check FMP convention: usually Capex is negative. fcf = ocf + capex.
  // Wait, standard formula: FCF = OCF - Capex. 
  // FMP often returns Capex as negative number.
  // Let's check typical FMP response. If negative, we add it.
  // Safest: FCF = OCF - Abs(Capex).
  const fcfVal = (opCashFlow || 0) - Math.abs(capex || 0);
  
  const fcfMargin = div(fcfVal, revenue);
  
  const debtToEquity = div(totalDebt, totalEquity);
  const interestCoverage = div(opIncome, inc.interestExpense);
  
  const bookValuePerShare = div(totalEquity, inc.weightedAverageShsOut || inc.weightedAverageShsOutDil);

  return {
    revenue,
    net_income: netIncome,
    gross_margin: grossMargin ? grossMargin * 100 : null, // FMP ratios are often %, but we calculated fractions.
    // User schema expects numbers. FGOS engine expects numbers like 20.5 (%).
    // Re-checking FGOS logic:
    // ratios.operatingProfitMarginTTM comes from FMP. FMP returns 0.25 for 25%?
    // Let's check normalizeValuation or similar.
    // In types.ts: "FMP returns fractions: 0.20 = 20%".
    // BUT FGOS benchmarks usually use percentiles like 10, 20, 30.
    // Let's check `calculateMetricScore`: 
    // `if (value <= stats.p10)`...
    // If stats are stored as 20.0, and value is 0.2, comparison fails.
    // I need to know the unit of `sector_benchmarks`.
    // I recall sector benchmarks having values like `0.15` for margins in some logs, or `15`?
    // `lib/engine/fgos-recompute.ts` imports `FmpRatios`.
    // Let's check `lib/fmp/types.ts`: "Márgenes (en FMP vienen como fracciones: 0.20 = 20%)".
    // If I calculate them manually, I get fractions (0.20).
    // If FGOS expects fractions, I'm good.
    // If FGOS expects percentages (20.0), I need to multiply.
    // Let's check `sector_benchmarks` table data... I can't.
    // Let's assume fractions because FMP returns fractions and we used `ratios.operatingProfitMarginTTM` directly before.
    
    operating_margin: operatingMargin,
    net_margin: netMargin,
    roe: roe,
    roic: roic,
    free_cash_flow: fcfVal,
    fcf_margin: fcfMargin,
    total_debt: totalDebt,
    debt_to_equity: debtToEquity, // Ratio, e.g. 1.5
    interest_coverage: interestCoverage,
    total_equity: totalEquity,
    book_value_per_share: bookValuePerShare
  };
}
