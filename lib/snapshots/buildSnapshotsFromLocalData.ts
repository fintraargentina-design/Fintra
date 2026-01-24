
import { supabaseAdmin } from '@/lib/supabase-admin';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { calculateIFS, type RelativePerformanceInputs } from '@/lib/engine/ifs';
import { calculateMarketPosition } from '@/lib/engine/market-position';
import { normalizeProfileStructural } from '@/app/api/cron/fmp-bulk/normalizeProfileStructural';
import type { FmpProfile, FmpRatios, FmpMetrics } from '@/lib/engine/types';

const SNAPSHOT_SOURCE = 'local_backfill_v1';
const ENGINE_VERSION = 'fintra-local-v1';

// Adapter to map DB columns to FMP camelCase expected by the engine
function mapDbToFmp(fin: any, activeStock?: any): { profile: FmpProfile, ratios: FmpRatios, metrics: FmpMetrics } {
  return {
    profile: {
      sector: activeStock?.sector ?? fin?.sector,
      industry: activeStock?.industry ?? fin?.industry,
      symbol: activeStock?.ticker ?? fin?.ticker,
      companyName: activeStock?.name ?? fin?.company_name
    },
    ratios: {
      operatingProfitMarginTTM: fin?.operating_margin ? Number(fin.operating_margin) : null,
      netProfitMarginTTM: fin?.net_margin ? Number(fin.net_margin) : null,
      debtEquityRatioTTM: fin?.debt_to_equity ? Number(fin.debt_to_equity) : null,
      interestCoverageTTM: fin?.interest_coverage ? Number(fin.interest_coverage) : null,
    },
    metrics: {
      roicTTM: fin?.roic ? Number(fin.roic) : null,
      freeCashFlowMarginTTM: fin?.fcf_margin ? Number(fin.fcf_margin) : null,
      altmanZScore: fin?.altman_z ? Number(fin.altman_z) : null,
      piotroskiScore: fin?.piotroski ? Number(fin.piotroski) : null
    }
  };
}

export async function buildSnapshotFromLocalData(ticker: string, date: string) {
  // 0. Fetch Universe Info (for Sector/Industry)
  const { data: universeData, error: universeError } = await supabaseAdmin
    .from('fintra_universe')
    .select('sector, industry, name, ticker')
    .eq('ticker', ticker)
    .maybeSingle();

  if (universeError) {
      console.error(`Error fetching universe data for ${ticker}:`, universeError);
  }
  // console.log(`Debug ${ticker} universeData:`, universeData);

  // 1. Fetch Financials (TTM/FY) <= date
  const { data: fin } = await supabaseAdmin
    .from('datos_financieros')
    .select('*')
    .eq('ticker', ticker)
    .lte('period_end_date', date)
    .in('period_type', ['TTM', 'FY'])
    .order('period_end_date', { ascending: false })
    .order('period_type', { ascending: false }) // Prefer TTM over FY if dates match
    .limit(1)
    .maybeSingle();

  const sector = universeData?.sector ?? fin?.sector;
  
  if (!sector) {
      // Without sector, we can't do FGOS, IFS, or Market Position.
      return { 
          ticker, 
          snapshot_date: date, 
          status: 'skipped', 
          reason: 'missing_sector' 
      };
  }

  // 2. Fetch Valuation
  const { data: valuation } = await supabaseAdmin
    .from('datos_valuacion')
    .select('*')
    .eq('ticker', ticker)
    .eq('valuation_date', date)
    .eq('denominator_type', 'TTM')
    .maybeSingle();

  // 3. Fetch Performance Windows (for IFS)
  // We need 1W, 1M, YTD, 1Y, 3Y, 5Y
  const windows = ['1W', '1M', 'YTD', '1Y', '3Y', '5Y'];
  const { data: perfData } = await supabaseAdmin
    .from('performance_windows')
    .select('window_code, asset_return, benchmark_return')
    .eq('ticker', ticker)
    .lte('as_of_date', date) // Use lte date, in case windows are from slightly before
    .order('as_of_date', { ascending: false }) // Get latest per window code
    .in('window_code', windows);
  
  const perfMap = new Map<string, number>(); // Stores relative performance
  if (perfData) {
      perfData.forEach((row: any) => {
          // If multiple rows for same window (due to lte date), we only take the first one (latest) because we iterate
          // But perfData might contain duplicates if we don't filter distinct on window_code or process carefully.
          // Since we order by date desc, the first occurrence of a window_code is the latest.
          if (!perfMap.has(row.window_code) && row.asset_return != null && row.benchmark_return != null) {
              perfMap.set(row.window_code, row.asset_return - row.benchmark_return);
          }
      });
  }

  // 4. Compute IFS
  const ifsInputs: RelativePerformanceInputs = {
      relative_vs_sector_1w: perfMap.get('1W') ?? null,
      relative_vs_sector_1m: perfMap.get('1M') ?? null,
      relative_vs_sector_ytd: perfMap.get('YTD') ?? null,
      relative_vs_sector_1y: perfMap.get('1Y') ?? null,
      relative_vs_sector_3y: perfMap.get('3Y') ?? null,
      relative_vs_sector_5y: perfMap.get('5Y') ?? null,
  };

  const ifs = calculateIFS(ifsInputs);

  // 5. Compute FGOS
  let fgos = null;
  let fgosStatus = 'pending';
  
  if (fin) {
      const { profile, ratios, metrics } = mapDbToFmp(fin, universeData);
      
      const fgosResult = await calculateFGOSFromData(
          ticker,
          profile,
          ratios,
          metrics,
          {
              revenue_cagr: fin.revenue_cagr ? Number(fin.revenue_cagr) : null,
              earnings_cagr: fin.earnings_cagr ? Number(fin.earnings_cagr) : null,
              fcf_cagr: fin.fcf_cagr ? Number(fin.fcf_cagr) : null
          },
          null, // confidenceInputs
          { price: 0 }, // quote placeholder
          null, // history
          null, // valuationTimeline
          date
      );
      
      if (fgosResult) {
          fgos = fgosResult;
          fgosStatus = fgosResult.fgos_status || 'computed';
      }
  }

  // 6. Market Position
  let marketPosition = null;
  if (fin && sector) {
      marketPosition = await calculateMarketPosition(
          ticker,
          sector,
          {
              marketCap: fin.market_cap ? Number(fin.market_cap) : null,
              roic: fin.roic ? Number(fin.roic) : null,
              operatingMargin: fin.operating_margin ? Number(fin.operating_margin) : null,
              revenueGrowth: fin.revenue_cagr ? Number(fin.revenue_cagr) : null
          },
          date
      );
  }

  // 7. Construct Snapshot
  // We need to match fintra_snapshots schema
  const { profile: fmpProfile, ratios: fmpRatios, metrics: fmpMetrics } = mapDbToFmp(fin, universeData);

  const snapshot = {
      ticker,
      snapshot_date: date,
      engine_version: ENGINE_VERSION,
      sector: sector,
      profile_structural: normalizeProfileStructural(fmpProfile, fmpRatios, fmpMetrics), // Re-uses existing logic
      
      // Market Snapshot (Required by schema)
      market_snapshot: {
          price: null,
          market_cap: valuation?.market_cap ?? null,
          pe_ratio: valuation?.pe_ratio ?? null,
          status: 'pending',
          source: 'local_backfill'
      },

      // IFS
      ifs: ifs,
      relative_vs_sector_1w: ifsInputs.relative_vs_sector_1w,
      relative_vs_sector_1m: ifsInputs.relative_vs_sector_1m,
      relative_vs_sector_ytd: ifsInputs.relative_vs_sector_ytd,
      relative_vs_sector_1y: ifsInputs.relative_vs_sector_1y,
      relative_vs_sector_3y: ifsInputs.relative_vs_sector_3y,
      relative_vs_sector_5y: ifsInputs.relative_vs_sector_5y,

      // FGOS
      fgos_score: fgos?.fgos_score ?? null,
      fgos_components: fgos?.fgos_breakdown ?? null,
      fgos_status: fgosStatus,
      fgos_confidence_percent: fgos?.confidence ?? 0,
      fgos_confidence_label: fgos?.confidence_label ?? 'Low',
      fgos_category: fgos?.fgos_category ?? 'Pending',

      // Valuation
      valuation: valuation ? {
          pe_ratio: valuation.pe_ratio,
          ev_ebitda: valuation.ev_ebitda,
          price_to_fcf: valuation.price_to_fcf,
          price_to_sales: valuation.price_to_sales,
          valuation_status: 'Computed'
      } : { status: 'pending', reason: 'missing_valuation_inputs' },

      market_position: marketPosition ?? { status: 'pending' },
      
      // Investment Verdict (Required by schema)
      investment_verdict: {
          verdict: 'Pending',
          reason: 'local_backfill'
      },

      // Metadata / Confidence
      data_confidence: {
          snapshot_source: SNAPSHOT_SOURCE,
          has_financials: !!fin,
          has_valuation: !!valuation,
          has_performance: !!perfData && perfData.length > 0,
          has_fgos: !!fgos,
          has_ifs: !!ifs
      }
  };

  return snapshot;
}
