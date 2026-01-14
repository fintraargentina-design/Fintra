import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain'; 
import { calculateMarketPosition } from '@/lib/engine/market-position';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import dayjs from 'dayjs';
import type { FmpProfile, FmpRatios, FmpMetrics } from '@/lib/engine/types';
import { normalizeProfileStructural } from '../fmp-bulk/normalizeProfileStructural';

const ENGINE_VERSION = 'fintra-engine@2.0.0';

// Adapter to map DB columns to FMP camelCase expected by the engine
function mapDbToFmp(fin: any): { profile: FmpProfile, ratios: FmpRatios, metrics: FmpMetrics } {
  return {
    profile: {
      sector: fin.sector,
      industry: fin.industry,
      symbol: fin.ticker,
      companyName: fin.company_name // Assuming column exists
    },
    ratios: {
      operatingProfitMarginTTM: fin.operating_margin,
      netProfitMarginTTM: fin.net_margin,
      debtEquityRatioTTM: fin.debt_to_equity,
      interestCoverageTTM: fin.interest_coverage,
    },
    metrics: {
      roicTTM: fin.roic,
      freeCashFlowMarginTTM: fin.fcf_margin,
      altmanZScore: fin.altman_z,
      piotroskiScore: fin.piotroski
    }
  };
}

export async function backfillSnapshotsForDate(date: string, targetTicker?: string) {
  const asOf = dayjs(date);

  // 1. Obtener tickers con datos ese día
  // Filter by active stocks only
  let uniqueTickers = new Set<string>();

  if (targetTicker) {
    console.log(`[Backfill] Debug mode: Processing only ${targetTicker}`);
    uniqueTickers.add(targetTicker);
  } else {
    const activeTickersList = await getActiveStockTickers(supabase);
    
    // TRUST THE UNIVERSE: Iterate all active tickers.
    // The loop below will check if financials exist for each ticker.
    // Previous optimization using datos_financieros query was hitting 1000 row limit.
    console.log(`[Backfill] Universe size: ${activeTickersList.length}`);
    activeTickersList.forEach(t => uniqueTickers.add(t));
  }

  for (const ticker of uniqueTickers) {
    // -----------------------------
    // 2. Financials vigentes
    // -----------------------------
    const { data: fin } = await supabase
      .from('datos_financieros')
      .select('*')
      .eq('ticker', ticker)
      .lte('period_end_date', date)
      .in('period_type', ['TTM','FY'])
      .order('period_end_date', { ascending: false })
      .limit(1)
      .single();

    if (!fin) {
        if (targetTicker) console.warn(`[Backfill] No financials found for ${ticker} on ${date}`);
        continue;
    }

    // -----------------------------
    // 3. Sector
    // -----------------------------
    const sector = fin.sector;
    if (!sector) {
        if (targetTicker) console.warn(`[Backfill] No sector found for ${ticker}`);
        continue;
    }

    // -----------------------------
    // 4. Sector stats (Unused in current engine but kept for reference)
    // -----------------------------
    // Engine v2 loads benchmarks internally via getBenchmarksForSector
    // Ideally we should inject historical benchmarks here
    
    // -----------------------------
    // 5. FGOS
    // -----------------------------
    const { profile, ratios, metrics } = mapDbToFmp(fin);
    
    const fgos = await calculateFGOSFromData(
        fin.ticker,
        profile,
        ratios,
        metrics,
        {
          revenue_cagr: fin.revenue_cagr,
          earnings_cagr: fin.earnings_cagr,
          fcf_cagr: fin.fcf_cagr // Assuming column exists
        },
        { price: 0 }, // No price in financials, usually from quote
        null, // financialHistory
        null, // performanceRows
        date
    );

    // -----------------------------
    // 6. Valuación
    // -----------------------------
    const { data: valuation } = await supabase
      .from('datos_valuacion')
      .select('*')
      .eq('ticker', ticker)
      .eq('valuation_date', date)
      .eq('denominator_type', 'TTM')
      .single();

    // -----------------------------
    // 7. Performance
    // -----------------------------
    const { data: perfRows } = await supabase
      .from('datos_performance')
      .select('*')
      .eq('ticker', ticker)
      .lte('date', date)
      .order('date', { ascending: false })
      .limit(1);
      
    const perf = perfRows?.[0] || null;

    // -----------------------------
    // 8. Market Position
    // -----------------------------
    const marketPosition = await calculateMarketPosition(
        ticker,
        sector,
        {
            marketCap: fin.market_cap || null,
            roic: metrics.roicTTM,
            operatingMargin: ratios.operatingProfitMarginTTM,
            revenueGrowth: fin.revenue_cagr
        },
        date
    );

    // -----------------------------
    // 9. Build Snapshot
    // -----------------------------
    // TODO: Use a typed builder or reuse buildSnapshot logic if possible
    // For now constructing object manually to match schema
    
    const snapshot = {
        ticker,
        snapshot_date: date,
        engine_version: ENGINE_VERSION,
        sector: sector,
        profile_structural: normalizeProfileStructural(profile, ratios, metrics),
        market_snapshot: perf ? {
            price: perf.close,
            ytd_percent: null, // Hard to calc without history
            div_yield: null
        } : null,
        fgos_score: fgos?.fgos_score ?? null,
        fgos_components: fgos?.fgos_breakdown ?? null,
        valuation: valuation ? {
            pe_ratio: valuation.pe_ratio,
            ev_ebitda: valuation.ev_ebitda,
            price_to_fcf: valuation.price_to_fcf,
            valuation_status: 'Pending' // Logic missing here
        } : null,
        market_position: marketPosition,
        investment_verdict: null,
        data_confidence: {
            has_profile: true,
            has_financials: true,
            has_valuation: !!valuation,
            has_performance: !!perf,
            has_fgos: !!fgos
        }
    };

    // Upsert
    const { error } = await supabase.from('fintra_snapshots').upsert(snapshot, { onConflict: 'ticker,snapshot_date' });
    if (error) {
        console.error(`[Backfill] Error upserting snapshot for ${ticker}:`, error);
    } else {
        if (targetTicker) console.log(`[Backfill] Snapshot upserted for ${ticker}`);
    }
  }
}
