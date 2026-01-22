// Fintra/app/api/cron/fmp-bulk/buildSnapshots.ts

import { normalizeValuation } from './normalizeValuation';
import { normalizePerformance } from './normalizePerformance';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { calculateMarketPosition } from '@/lib/engine/market-position';
import { normalizeProfileStructural } from './normalizeProfileStructural';
import { resolveInvestmentVerdict } from '@/lib/engine/resolveInvestmentVerdict';
import { rollingFYGrowth } from '@/lib/utils/rollingGrowth';
import { getBenchmarksForSector } from '@/lib/engine/benchmarks';
import { buildValuationState } from '@/lib/engine/resolveValuationFromSector';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { FinancialSnapshot, FmpProfile, FmpRatios, FmpMetrics, FmpQuote } from '@/lib/engine/types';

// Hydration Imports
import { calculateDividendQuality } from '@/lib/engine/dividend-quality';
import { calculateRelativeReturn, type RelativeReturnTimeline, type RelativeReturnWindow } from '@/lib/engine/relative-return';
import { resolveFintraVerdict } from '@/lib/engine/fintra-verdict';
import type { SentimentValuationTimeline, SentimentSnapshotLabel, SentimentValuationSnapshot } from '@/lib/engine/sentiment';

import { calculateIFS, type RelativePerformanceInputs } from '@/lib/engine/ifs';

export const SNAPSHOT_ENGINE_VERSION = 'v3.2-full-hydration';

/* ================================
   Helpers
================================ */

function pending(reason: string, extra: any = {}) {
  return {
    status: 'pending',
    computed: false,
    reason,
    ...extra
  };
}

function discard(sym: string, reason: string, extra: any = {}) {
  console.warn('📉 TICKER DISCARDED', { sym, reason, ...extra });
  return null;
}

function buildSentimentTimeline(rows: any[]): SentimentValuationTimeline | null {
  if (!rows || rows.length === 0) return null;

  // Helper to find closest row to a target date
  const findClosest = (targetDate: Date) => {
    let closest = null;
    let minDiff = Infinity;
    for (const row of rows) {
      if (!row.valuation_date) continue;
      const d = new Date(row.valuation_date);
      const diff = Math.abs(d.getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = row;
      }
    }
    // Allow max 60 days drift for TTM, maybe more for historical?
    // For now, loose tolerance to catch any available history
    return closest;
  };

  const today = new Date();
  const y1 = new Date(today); y1.setFullYear(today.getFullYear() - 1);
  const y3 = new Date(today); y3.setFullYear(today.getFullYear() - 3);
  const y5 = new Date(today); y5.setFullYear(today.getFullYear() - 5);

  const ttm = findClosest(today);
  const ttm1 = findClosest(y1);
  const ttm3 = findClosest(y3);
  const ttm5 = findClosest(y5);

  // Map row to snapshot
  const mapRow = (r: any): SentimentValuationSnapshot | null => {
    if (!r) return null;
    return {
      pe_ratio: r.pe_ratio,
      ev_ebitda: r.ev_ebitda,
      price_to_fcf: r.price_to_fcf,
      price_to_sales: r.price_to_sales
    };
  };

  return {
    TTM: mapRow(ttm),
    TTM_1A: mapRow(ttm1),
    TTM_3A: mapRow(ttm3),
    TTM_5A: mapRow(ttm5)
  };
}

function buildRelativeReturnTimeline(
  assetRows: any[],
  benchmarkRows: any[]
): RelativeReturnTimeline | null {
  const windows: RelativeReturnWindow[] = ['1Y', '3Y', '5Y'];
  const timeline: RelativeReturnTimeline = { '1Y': null, '3Y': null, '5Y': null };
  let hasData = false;

  for (const w of windows) {
    const asset = assetRows.find((r) => r.window_code === w);
    const bench = benchmarkRows.find((r) => r.window_code === w);

    if (asset && bench) {
      timeline[w] = {
        asset_return: asset.return_percent,
        benchmark_return: bench.return_percent,
        asset_max_drawdown: asset.max_drawdown,
        benchmark_max_drawdown: bench.max_drawdown
      };
      hasData = true;
    }
  }

  return hasData ? timeline : null;
}

/* ================================
   IFS LOGIC (DEPRECATED - REMOVED)
================================ */
// Logic moved to @/lib/engine/ifs.ts

/* ================================
   SNAPSHOT BUILDER
================================ */

export async function buildSnapshot(
  sym: string,
  profile: FmpProfile | null,
  ratios: FmpRatios | null,
  metrics: FmpMetrics | null,
  quote: FmpQuote | null,
  _priceChange: any,
  scores: any,
  incomeGrowthRows: any[] = [],
  cashflowGrowthRows: any[] = [],
  financialHistory: any[] = [],
  performanceRows: any[] = [],
  valuationRows: any[] = [],
  benchmarkRows: any[] = [],
  allSectorPerformance: Map<string, any[]> = new Map()
): Promise<FinancialSnapshot> {
  console.log('🧪 SNAPSHOT START', sym);

  // 🔍 DEBUG: Log missing components explicitly
  const missingItems: string[] = [];
  if (!profile) missingItems.push('Profile');
  if (!ratios || Object.keys(ratios).length === 0) missingItems.push('Ratios');
  if (!metrics || Object.keys(metrics).length === 0) missingItems.push('Metrics');
  if (!scores || Object.keys(scores).length === 0) missingItems.push('Scores');
  if (incomeGrowthRows.length === 0) missingItems.push('IncomeGrowth');
  if (cashflowGrowthRows.length === 0) missingItems.push('CashflowGrowth');

  if (missingItems.length > 0) {
    console.warn(`⚠️ MISSING DATA [${sym}]: ${missingItems.join(', ')}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  /* --------------------------------
     CLASIFICACIÓN (READ-ONLY)
  -------------------------------- */
  let sector: string | null = null;
  let industry: string | null = null;
  let classificationStatus: 'full' | 'partial' | 'missing' = 'missing';
  let sectorSource: 'canonical' | 'profile_fallback' | undefined;

  try {
    // 1. PRIMARY (fintra_universe) - New Source of Truth
    // asset_industry_map is currently empty and has schema issues, so we use universe.
    const { data: universeRow } = await supabaseAdmin
      .from('fintra_universe')
      .select('sector, industry')
      .eq('ticker', sym)
      .maybeSingle();

    if (universeRow && universeRow.sector) {
      sector = universeRow.sector;
      industry = universeRow.industry || null;
      sectorSource = 'canonical';
      classificationStatus = 'full';
    }
    // 2. FALLBACK (company_profile)
    else if (profile && profile.sector) {
      sector = profile.sector;
      industry = profile.industry || null;
      sectorSource = 'profile_fallback';
      classificationStatus = 'full';
    }
    else {
      classificationStatus = 'partial';
    }
  } catch {
    classificationStatus = 'partial';
  }

  if (!sector) {
    console.warn('⚠️ SECTOR MISSING', sym);
  }

  /* --------------------------------
     SECTOR PERFORMANCE (READ-ONLY)
  -------------------------------- */
  const SECTOR_WINDOW_CODES = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'] as const;
  type SectorWindowCode = (typeof SECTOR_WINDOW_CODES)[number];

  let sectorPerformanceStatus: 'full' | 'partial' | 'missing' = 'missing';
  const sectorPerformanceData: { [K in SectorWindowCode]?: number | null } = {};

  if (sector) {
    try {
      const { data: sectorRows } = await supabaseAdmin
        .from('sector_performance')
        .select('window_code, return_percent')
        .eq('sector', sector)
        .eq('performance_date', today);

      if (sectorRows && sectorRows.length > 0) {
        let presentCount = 0;

        for (const row of sectorRows as any[]) {
          const rawCode = row.window_code as string | null;
          if (!rawCode) continue;
          const code = SECTOR_WINDOW_CODES.find((c) => c === rawCode) as SectorWindowCode | undefined;
          if (!code) continue;

          sectorPerformanceData[code] = typeof row.return_percent === 'number' ? row.return_percent : row.return_percent ?? null;
          presentCount += 1;
        }

        if (presentCount === 0) {
          sectorPerformanceStatus = 'missing';
        } else if (presentCount === SECTOR_WINDOW_CODES.length) {
          sectorPerformanceStatus = 'full';
        } else {
          sectorPerformanceStatus = 'partial';
        }
      }
    } catch {
      sectorPerformanceStatus = 'partial';
    }
  }

  /* --------------------------------
     SECTOR PE (READ-ONLY)
  -------------------------------- */
  let sectorPeStatus: 'full' | 'partial' | 'missing' = 'missing';
  let sectorPeValue: number | null = null;

  if (sector) {
    try {
      const { data: peRows } = await supabaseAdmin
        .from('sector_pe')
        .select('pe_date, pe')
        .eq('sector', sector)
        .lte('pe_date', today)
        .order('pe_date', { ascending: false })
        .limit(1);

      if (peRows && peRows.length > 0) {
        const row = peRows[0] as any;
        const rowDate = row.pe_date as string | null;
        const rawPe = row.pe as number | string | null | undefined;

        if (typeof rawPe === 'number') {
          sectorPeValue = Number.isFinite(rawPe) ? rawPe : null;
        } else if (typeof rawPe === 'string') {
          const parsed = parseFloat(rawPe);
          sectorPeValue = Number.isFinite(parsed) ? parsed : null;
        } else {
          sectorPeValue = null;
        }

        if (rowDate === today) {
          sectorPeStatus = 'full';
        } else {
          sectorPeStatus = 'partial';
        }
      }
    } catch {
      sectorPeStatus = 'partial';
    }
  }

  /* --------------------------------
     INDUSTRY PERFORMANCE (READ-ONLY)
  -------------------------------- */
  const INDUSTRY_WINDOW_CODES = ['1D', '1W', '1M', 'YTD', '1Y', '3Y', '5Y'] as const;
  type IndustryWindowCode = (typeof INDUSTRY_WINDOW_CODES)[number];

  let industryPerformanceStatus: 'full' | 'partial' | 'missing' = 'missing';
  const industryPerformanceData: { [K in IndustryWindowCode]?: number | null } = {};

  if (industry) {
    try {
      // Strategy: Parallel queries per window to ensure we get the latest row for EACH window
      // regardless of data density or sparsity. This avoids the "limit 100" trap.
      const promises = INDUSTRY_WINDOW_CODES.map(async (code) => {
        const { data } = await supabaseAdmin
          .from('industry_performance')
          .select('return_percent, performance_date')
          .eq('industry', industry)
          .eq('window_code', code)
          .lte('performance_date', today)
          .order('performance_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { code, data };
      });

      const results = await Promise.all(promises);

      let presentCount = 0;
      let allUsedAreToday = true;

      for (const { code, data } of results) {
        if (data) {
           industryPerformanceData[code] = typeof data.return_percent === 'number' 
             ? data.return_percent 
             : data.return_percent ?? null;
           presentCount += 1;
           
           if (data.performance_date !== today) {
             allUsedAreToday = false;
           }
        } else {
           allUsedAreToday = false; 
        }
      }

      if (presentCount === 0) {
        industryPerformanceStatus = 'missing';
      } else if (presentCount === INDUSTRY_WINDOW_CODES.length && allUsedAreToday) {
        industryPerformanceStatus = 'full';
      } else {
        industryPerformanceStatus = 'partial';
      }
    } catch (err) {
      console.warn(`⚠️ INDUSTRY PERFORMANCE ERROR [${sym}]:`, err);
      industryPerformanceStatus = 'partial'; 
    }
  }

  /* --------------------------------
     PROFILE STRUCTURAL (TOLERANTE)
  -------------------------------- */
  const profileStructural =
    profile
      ? normalizeProfileStructural(profile, ratios, scores)
      : pending('Profile not available in bulk');

  /* --------------------------------
     IFS (READ-ONLY) - REMOVED
  -------------------------------- */
  // Old logic removed. New logic is below relative performance calculation.


  /* --------------------------------
     PERFORMANCE (TOLERANTE)
  -------------------------------- */
  const performance = normalizePerformance(
    profile,
    quote,
    null,
    metrics,
    ratios
  );

  /* --------------------------------
     GROWTH REAL (BULK)
  -------------------------------- */
  const fundamentalsGrowth = {
    revenue_cagr: rollingFYGrowth(incomeGrowthRows, 'growthRevenue'),
    earnings_cagr: rollingFYGrowth(incomeGrowthRows, 'growthNetIncome'),
    fcf_cagr: rollingFYGrowth(cashflowGrowthRows, 'growthFreeCashFlow')
  };

  /* --------------------------------
     FGOS (NUNCA DESCARTA SNAPSHOT)
  -------------------------------- */
  // Prepare Confidence Inputs
  let years_since_ipo = 10;
  if (profile?.ipoDate) {
    const ipo = new Date(profile.ipoDate);
    const now = new Date();
    if (!isNaN(ipo.getTime())) {
      years_since_ipo = (now.getTime() - ipo.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    }
  }

  const financial_history_years = incomeGrowthRows.length > 0 ? incomeGrowthRows.length + 1 : 0;

  let earnings_volatility_class: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (incomeGrowthRows.length >= 2) {
      const growthRates = incomeGrowthRows.map(r => r.growthRevenue).filter((g: any) => typeof g === 'number');
      if (growthRates.length >= 2) {
          const mean = growthRates.reduce((a: number, b: number) => a + b, 0) / growthRates.length;
          const variance = growthRates.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / growthRates.length;
          const stdDev = Math.sqrt(variance);
          if (stdDev < 0.15) earnings_volatility_class = 'LOW';
          else if (stdDev > 0.40) earnings_volatility_class = 'HIGH';
      }
  }

  const confidenceInputs = {
      financial_history_years,
      years_since_ipo,
      earnings_volatility_class
  };

  // Build Sentiment Timeline for FGOS (and Verdict)
  const sentimentTimeline = buildSentimentTimeline(valuationRows);

  const fgos =
    sector
      ? await calculateFGOSFromData(
          sym,
          profile ?? {},
          ratios ?? {},
          metrics ?? {},
          fundamentalsGrowth,
          confidenceInputs,
          quote ?? {},
          financialHistory.length > 0 ? financialHistory : null, // Moat
          sentimentTimeline, // Sentiment
          today
        )
      : null;

  const fgosStatus =
    fgos && typeof fgos.fgos_score === 'number'
      ? 'computed'
      : 'pending';

  /* --------------------------------
     VALUATION
  -------------------------------- */
  let valuation = normalizeValuation(ratios, profile);

  if (valuation && sector) {
    const sectorBenchmarks = await getBenchmarksForSector(sector, today);
    if (sectorBenchmarks) {
      const valState = buildValuationState({
        sector,
        pe_ratio: valuation.pe_ratio,
        ev_ebitda: valuation.ev_ebitda,
        price_to_fcf: valuation.price_to_fcf
      }, sectorBenchmarks as any);

      valuation = {
        ...valuation,
        stage: valState.stage,
        // Canonical status stored separately; legacy field kept for compat
        valuation_status:
          valState.valuation_status === 'cheap_sector'
            ? 'undervalued'
            : valState.valuation_status === 'expensive_sector'
            ? 'overvalued'
            : valState.valuation_status === 'fair_sector'
            ? 'fair'
            : 'pending',
        canonical_status: valState.valuation_status,
        confidence: valState.confidence,
        explanation: valState.explanation
      };
    }
  }

  /* --------------------------------
     ADDITIONAL ENGINES (Hydration)
  -------------------------------- */

  // 1. Dividend Quality
  const dividendQuality = calculateDividendQuality([]);

  // 2. Relative Return
  const relativeReturnTimeline = buildRelativeReturnTimeline(performanceRows, benchmarkRows);
  const relativeReturn = calculateRelativeReturn(relativeReturnTimeline);

  // 3. Fintra Verdict
  const verdictInputs = {
    fgos: {
      score: fgos?.fgos_score ?? null,
      band: fgos?.fgos_category === 'High' ? 'strong' : fgos?.fgos_category === 'Medium' ? 'defendable' : fgos?.fgos_category === 'Low' ? 'weak' : null,
      confidence: fgos?.confidence ?? null
    },
    competitive_advantage: fgos?.fgos_breakdown?.competitive_advantage
      ? {
          score: fgos.fgos_breakdown.competitive_advantage.score,
          band: fgos.fgos_breakdown.competitive_advantage.band,
          confidence: fgos.fgos_breakdown.competitive_advantage.confidence
        }
      : undefined,
    sentiment: fgos?.fgos_breakdown?.sentiment_details
      ? {
          score: fgos.fgos_breakdown.sentiment_details.value,
          band: fgos.fgos_breakdown.sentiment_details.band ?? null,
          confidence: fgos.fgos_breakdown.sentiment_details.confidence
        }
      : undefined,
    dividend_quality: {
      score: dividendQuality.score,
      band: dividendQuality.band,
      confidence: dividendQuality.confidence
    },
    relative_return: {
      score: relativeReturn.score,
      band: relativeReturn.band,
      confidence: relativeReturn.confidence
    }
  };

  const fintraVerdict = resolveFintraVerdict(verdictInputs as any);

  /* --------------------------------
     MARKET POSITION
  -------------------------------- */
  const marketPosition = await calculateMarketPosition(
    sym,
    sector,
    {
      marketCap: profile?.marketCap,
      roic: metrics?.roicTTM,
      operatingMargin: ratios?.operatingProfitMarginTTM,
      revenueGrowth: fundamentalsGrowth.revenue_cagr
    },
    today
  );

  /* --------------------------------
     RELATIVE PERFORMANCE (Explicit Columns)
  -------------------------------- */
  const relPerf: any = {};
  const relWindows = ['1W', '1M', 'YTD', '1Y', '3Y', '5Y'];

  // Retrieve sector rows using the resolved sector
  const sectorRows = sector ? allSectorPerformance.get(sector) || [] : [];
  
  for (const w of relWindows) {
     const stockRow = performanceRows.find(r => r.window_code === w);
     const marketRow = benchmarkRows.find(r => r.window_code === w); // SPY
     const sectorRow = sectorRows.find(r => r.window_code === w);

     const stockRet = stockRow?.return_percent;
     const marketRet = marketRow?.return_percent;
     const sectorRet = sectorRow?.return_percent;

     const keySuffix = w.toLowerCase();

     // Vs Market
     if (typeof stockRet === 'number' && typeof marketRet === 'number') {
        relPerf[`relative_vs_market_${keySuffix}`] = stockRet - marketRet;
     } else {
        relPerf[`relative_vs_market_${keySuffix}`] = null;
     }

     // Vs Sector
     if (typeof stockRet === 'number' && typeof sectorRet === 'number') {
        relPerf[`relative_vs_sector_${keySuffix}`] = stockRet - sectorRet;
     } else {
        relPerf[`relative_vs_sector_${keySuffix}`] = null;
     }
  }

  /* --------------------------------
     IFS (MAJORITY VOTING)
  -------------------------------- */
  const ifsInputs: RelativePerformanceInputs = {
    relative_vs_sector_1w: relPerf.relative_vs_sector_1w ?? null,
    relative_vs_sector_1m: relPerf.relative_vs_sector_1m ?? null,
    relative_vs_sector_ytd: relPerf.relative_vs_sector_ytd ?? null,
    relative_vs_sector_1y: relPerf.relative_vs_sector_1y ?? null,
    relative_vs_sector_3y: relPerf.relative_vs_sector_3y ?? null,
    relative_vs_sector_5y: relPerf.relative_vs_sector_5y ?? null
  };
  
  const ifs = calculateIFS(ifsInputs);

  /* --------------------------------
     SNAPSHOT FINAL
  -------------------------------- */
  return {
    ticker: sym,
    snapshot_date: today,
    engine_version: SNAPSHOT_ENGINE_VERSION,

    // 🔴 Persistencia explícita
    sector,
    classification: {
      status: classificationStatus,
      sector,
      industry,
      source: sectorSource,
    },

    // Spread Relative Performance Fields
    ...relPerf,

    sector_performance: {
      status: sectorPerformanceStatus,
      data: sectorPerformanceData,
    },

    industry_performance: {
      status: industryPerformanceStatus,
      data: industryPerformanceData,
    },

    sector_pe: {
      status: sectorPeStatus,
      value: sectorPeValue,
    },

    profile_structural: profileStructural,
    market_snapshot: performance ?? null,
    fundamentals_growth: fundamentalsGrowth,

    fgos_score: fgos?.fgos_score ?? null,
    fgos_components: fgos?.fgos_breakdown ?? null,
    fgos_status: fgosStatus,
    fgos_category: fgos?.fgos_category ?? null,
    fgos_confidence_percent: fgos?.confidence ?? null,
    fgos_confidence_label: fgos?.confidence_label ?? null,
    fgos_maturity: fgos?.fgos_status ?? null,
    peers: null, // Pending implementation

    valuation: valuation ?? {
      pe_ratio: null,
      ev_ebitda: null,
      price_to_fcf: null,
      valuation_status: 'pending',
      stage: 'pending',
      confidence: {
        label: 'Low',
        percent: 0,
        valid_metrics_count: 0
      },
      explanation: 'Insufficient data to determine valuation status.'
    },
    market_position: marketPosition,
    
    // Legacy Investment Verdict (Optional: keep or replace with Fintra Verdict?)
    // Using Fintra Verdict for now as it's the requested hydration
    investment_verdict: fintraVerdict,
    ifs: ifs,
    strategic_state: fintraVerdict, // Persist into strategic_state as requested

    relative_return: relativeReturn,

    data_confidence: {
      has_profile: !!profile,
      has_financials: !!ratios || !!metrics,
      has_valuation: !!valuation,
      has_performance: !!performance,
      has_fgos: fgosStatus === 'computed'
    }
  };
}
