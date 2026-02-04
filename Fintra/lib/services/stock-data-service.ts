import { supabaseAdmin } from '@/lib/supabase-admin';
import { createFmpClient } from '@/lib/fmp/factory';
import { fmpGet } from '@/lib/fmp/server';
import dayjs from 'dayjs';
import { buildFGOSState } from '@/lib/engine/fgos-state';

// Server-side FMP client
const serverFetcher = async <T>(path: string, opts?: { params?: any; cache?: RequestCache }) => {
  return fmpGet<T>(path, opts?.params, { init: { cache: opts?.cache } });
};

const fmp = createFmpClient(serverFetcher);

type DataBlock = 'profile' | 'financials' | 'valuation' | 'performance';

export async function ensureCompanyData(symbol: string) {
  const ticker = symbol.toUpperCase();
  const missingBlocks: DataBlock[] = [];

  // 1. Check Completeness (Parallel DB Checks)
  const [
    { data: snapshot },
    { count: financialsCount },
    { count: valuationCount },
    { count: performanceCount }
  ] = await Promise.all([
    supabaseAdmin.from('fintra_snapshots').select('profile_structural').eq('ticker', ticker).single(),
    supabaseAdmin.from('datos_financieros').select('*', { count: 'exact', head: true }).eq('ticker', ticker),
    supabaseAdmin.from('datos_valuacion').select('*', { count: 'exact', head: true }).eq('ticker', ticker),
    supabaseAdmin.from('datos_performance').select('*', { count: 'exact', head: true }).eq('ticker', ticker)
  ]);

  // Evaluate structural presence
  if (!snapshot || !snapshot.profile_structural) missingBlocks.push('profile');
  if (!financialsCount || financialsCount === 0) missingBlocks.push('financials');
  if (!valuationCount || valuationCount === 0) missingBlocks.push('valuation');
  if (!performanceCount || performanceCount === 0) missingBlocks.push('performance');

  if (missingBlocks.length === 0) {
    return { status: 'complete', missing: [] };
  }

  console.log(`[StockLoader] Missing blocks for ${ticker}:`, missingBlocks);

  // 2. Fetch and Persist Missing Blocks
  await fetchAndPersist(ticker, missingBlocks);

  return { status: 'updated', missing: missingBlocks };
}

async function fetchAndPersist(ticker: string, blocks: DataBlock[]) {
  const promises = [];

  if (blocks.includes('profile')) {
    promises.push(fetchAndPersistProfile(ticker));
  }
  if (blocks.includes('financials')) {
    promises.push(fetchAndPersistFinancials(ticker));
  }
  if (blocks.includes('valuation')) {
    promises.push(fetchAndPersistValuation(ticker));
  }
  if (blocks.includes('performance')) {
    promises.push(fetchAndPersistPerformance(ticker));
  }

  await Promise.all(promises);
}

async function fetchAndPersistProfile(ticker: string) {
  try {
    const profiles = await fmp.profile(ticker);
    if (!profiles || profiles.length === 0) return;

    const p = profiles[0];
    const profileData = {
      companyName: p.companyName,
      sector: p.sector,
      industry: p.industry,
      description: p.description,
      website: p.website,
      ceo: p.ceo,
      exchange: p.exchange,
      currency: p.currency,
      country: p.country,
      image: p.image,
      price: p.price,
      mktCap: p.mktCap,
      changes: p.changes,
      lastDiv: p.lastDiv,
      beta: p.beta,
      volAvg: p.volAvg,
      range: p.range
    };

    // Upsert to fintra_snapshots
    // Check if a snapshot exists for today?
    const today = dayjs().format('YYYY-MM-DD');
    
    // We will upsert into fintra_snapshots. 
    // Assuming engine_version is 'v1' or similar default.
    const row = {
      ticker,
      snapshot_date: today,
      engine_version: 'v1',
      profile_structural: profileData,
      // Initialize other fields if new
      fgos_status: 'pending',
      valuation: { status: 'pending' },
      updated_at: new Date().toISOString()
    };

    await supabaseAdmin.from('fintra_snapshots').upsert(row, {
        onConflict: 'ticker,snapshot_date,engine_version'
    });

  } catch (err) {
    console.error(`[StockLoader] Error fetching profile for ${ticker}:`, err);
  }
}

async function fetchAndPersistFinancials(ticker: string) {
  try {
    // Fetch Income, Balance, Cash, Ratios (Annual and Quarter)
    // Limit to reasonable history (e.g. 10 periods).
    const limit = 20; 

    const [income, balance, cash, ratios] = await Promise.all([
      fmp.incomeStatement(ticker, { limit }),
      fmp.balanceSheet(ticker, { limit }),
      fmp.cashflow(ticker, { limit }),
      fmp.ratiosTTM(ticker) // TTM Ratios
    ]);

    if (!income.length) return;

    // Normalize and Insert
    // We need to merge Income/Balance/Cash by date/period
    const rows = [];
    
    // Helper to find matching statement
    const findMatch = (arr: any[], date: string, period: string) => 
      arr.find(x => x.date === date && x.period === period);

    for (const inc of income) {
      const bal = findMatch(balance, inc.date, inc.period);
      const cfs = findMatch(cash, inc.date, inc.period);
      
      if (!bal || !cfs) continue;

      const row = {
        ticker,
        period_type: inc.period === 'FY' ? 'FY' : 'Q',
        period_label: inc.calendarYear ? `${inc.calendarYear}${inc.period}` : inc.period, // e.g. 2023FY or 2023Q1
        period_end_date: inc.date,
        
        revenue: inc.revenue,
        net_income: inc.netIncome,
        gross_margin: inc.grossProfitRatio,
        operating_margin: inc.operatingIncomeRatio,
        net_margin: inc.netIncomeRatio,
        
        free_cash_flow: cfs.freeCashFlow,
        
        total_debt: bal.totalDebt,
        total_equity: bal.totalStockholdersEquity,
        debt_to_equity: bal.totalStockholdersEquity ? bal.totalDebt / bal.totalStockholdersEquity : null,
        
        ebitda: inc.ebitda,
        ebitda_margin: inc.revenue ? inc.ebitda / inc.revenue : null,
        interest_coverage: inc.interestExpense ? inc.ebitda / inc.interestExpense : null, // Approx
        
        source: 'FMP_FALLBACK',
        data_completeness: 100,
        data_freshness: 100
      };
      
      // Fix period_label
      if (row.period_type === 'FY') {
        row.period_label = inc.calendarYear || inc.date.substring(0, 4);
      } else {
        row.period_label = `${inc.calendarYear || inc.date.substring(0, 4)}${inc.period}`;
      }

      rows.push(row);
    }

    if (rows.length > 0) {
      await supabaseAdmin.from('datos_financieros').upsert(rows, {
        onConflict: 'ticker,period_type,period_label'
      });
    }

  } catch (err) {
    console.error(`[StockLoader] Error fetching financials for ${ticker}:`, err);
  }
}

async function fetchAndPersistValuation(ticker: string) {
  try {
    const [metrics, quote] = await Promise.all([
      fmp.keyMetricsTTM(ticker),
      fmp.quote(ticker)
    ]);

    if (!metrics || !metrics.length) return;
    const m = metrics[0];
    const q = quote && quote.length ? quote[0] : null;

    const row = {
      ticker,
      valuation_date: new Date().toISOString().slice(0, 10),
      denominator_type: 'TTM',
      denominator_period: 'Current', 
      
      price: q ? q.price : null,
      market_cap: m.marketCap,
      enterprise_value: m.enterpriseValue,
      pe_ratio: m.peRatio,
      pe_forward: null, 
      peg_ratio: m.pegRatio,
      price_to_book: m.pbRatio,
      price_to_sales: m.priceToSalesRatio,
      price_to_fcf: m.pfcfRatio,
      dividend_yield: m.dividendYield,
      
      source: 'FMP_FALLBACK'
    };

    await supabaseAdmin.from('datos_valuacion').upsert(row, {
        onConflict: 'ticker,valuation_date,denominator_type,denominator_period'
    });

  } catch (err) {
    console.error(`[StockLoader] Error fetching valuation for ${ticker}:`, err);
  }
}

async function fetchAndPersistPerformance(ticker: string) {
  try {
    // /stock-price-change/{symbol}
    const changes = await fmp.stockPriceChange(ticker);
    if (!changes || !changes.length) return;
    
    const c = changes[0];
    const today = new Date().toISOString().slice(0, 10);

    const windows = [
      { code: '1D', val: c['1D'] },
      { code: '5D', val: c['5D'] }, // Map to 1W?
      { code: '1M', val: c['1M'] },
      { code: '3M', val: c['3M'] },
      { code: '6M', val: c['6M'] },
      { code: 'YTD', val: c['ytd'] },
      { code: '1Y', val: c['1Y'] },
      { code: '3Y', val: c['3Y'] },
      { code: '5Y', val: c['5Y'] },
    ];

    const rows = windows.map(w => ({
      ticker,
      performance_date: today,
      window_code: w.code === '5D' ? '1W' : w.code,
      return_percent: w.val,
      source: 'FMP_FALLBACK'
    })).filter(r => r.return_percent !== undefined);

    if (rows.length > 0) {
       await supabaseAdmin.from('datos_performance').upsert(rows, {
           onConflict: 'ticker,performance_date,window_code'
       });
    }

  } catch (err) {
    console.error(`[StockLoader] Error fetching performance for ${ticker}:`, err);
  }
}

export async function getUnifiedStockData(symbol: string) {
    const ticker = symbol.toUpperCase();
    
    // 1. Ensure Data Exists
    await ensureCompanyData(ticker);

    // 2. Fetch from DB
    const { data: snapshot } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('*')
        .eq('ticker', ticker)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    const { data: performanceRows } = await supabaseAdmin
        .from('datos_performance')
        .select('*')
        .eq('ticker', ticker)
        .order('performance_date', { ascending: false })
        .limit(50); // Get recent rows to cover all windows

    // 3. Construct Unified Response
    
    // Map Profile (Basic Data)
    let basicData: any = null;
    if (snapshot && snapshot.profile_structural) {
        const p = snapshot.profile_structural;
        // Construct StockData-like object
        basicData = {
            symbol: ticker,
            companyName: p.companyName,
            price: p.price,
            mktCap: p.mktCap,
            changes: p.changes,
            currency: p.currency,
            exchange: p.exchange,
            industry: p.industry,
            sector: p.sector,
            description: p.description,
            ceo: p.ceo,
            website: p.website,
            image: p.image,
            lastDiv: p.lastDiv,
            beta: p.beta,
            volAvg: p.volAvg,
            range: p.range,
            // Fallback for fields not in profile_structural but expected by UI
            // We might need to fetch financials to populate some fields like 'roe', 'net_margin'
            // But frontend likely uses other tabs for detailed financials.
            // The StockData interface has them as optional.
        };
    }

    // Map Analysis
    let analysisData: any = null;
    if (snapshot) {
        analysisData = {
            symbol: ticker,
            fgos_score: snapshot.fgos_score,
            fgos_breakdown: snapshot.fgos_components || snapshot.fgos_breakdown, // Map components to breakdown for UI
            fgos_state: buildFGOSState({
                fgos_score: snapshot.fgos_score,
                fgos_components: snapshot.fgos_components || snapshot.fgos_breakdown,
                fgos_confidence_percent: snapshot.fgos_confidence_percent,
                fgos_confidence_label: snapshot.fgos_confidence_label,
                fgos_status: snapshot.fgos_status,
                fgos_maturity: snapshot.fgos_maturity
            }),
            valuation_status: snapshot.valuation?.valuation_status,
            investment_verdict: snapshot.investment_verdict,
            // Map legacy fields if needed
            recommendation: snapshot.investment_verdict?.summary,
            analyst_rating: snapshot.investment_verdict?.verdict
        };
    }

    // Map Performance
    let performanceData: any = null;
    if (performanceRows && performanceRows.length > 0) {
        // Group by window_code, take latest
        // Assuming sorted by date desc, the first occurrence of each window_code is the latest
        const latestPerfMap = new Map();
        for (const row of performanceRows) {
            if (!latestPerfMap.has(row.window_code)) {
                latestPerfMap.set(row.window_code, row.return_percent);
            }
        }
        
        performanceData = {
            symbol: ticker,
            day_1: latestPerfMap.get('1D'),
            week_1: latestPerfMap.get('1W') || latestPerfMap.get('5D'),
            month_1: latestPerfMap.get('1M'),
            month_3: latestPerfMap.get('3M'),
            month_6: latestPerfMap.get('6M'),
            ytd: latestPerfMap.get('YTD'),
            year_1: latestPerfMap.get('1Y'),
            year_3: latestPerfMap.get('3Y'), // Not in interface? It is in my memory.
        };
    }

    // 4. Ecosystem Data (Live Fetch - Optional)
    let ecosystemData = null;
    try {
        const [holders, insiders] = await Promise.all([
            fmp.institutionalHolders(ticker),
            fmp.insiderTrading(ticker, { limit: 20 })
        ]);
        ecosystemData = { holders, insiders };
    } catch (e) {
        console.warn(`[StockLoader] Error fetching ecosystem for ${ticker}:`, e);
    }

    return {
        basicData,
        analysisData,
        performanceData,
        ecosystemData
    };
}
