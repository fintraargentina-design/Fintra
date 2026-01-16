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
import type { FinancialSnapshot, FmpProfile, FmpRatios, FmpMetrics, FmpQuote } from '@/lib/engine/types';

// Hydration Imports
import { calculateDividendQuality } from '@/lib/engine/dividend-quality';
import { calculateRelativeReturn, type RelativeReturnTimeline, type RelativeReturnWindow } from '@/lib/engine/relative-return';
import { resolveFintraVerdict } from '@/lib/engine/fintra-verdict';
import type { SentimentValuationTimeline, SentimentSnapshotLabel, SentimentValuationSnapshot } from '@/lib/engine/sentiment';

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
  benchmarkRows: any[] = []
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
     SECTOR (FUENTE ÚNICA)
  -------------------------------- */
  const sector =
    profile?.sector ??
    profile?.Sector ??
    null;

  if (!sector) {
    console.warn('⚠️ SECTOR MISSING', sym);
  }

  /* --------------------------------
     PROFILE STRUCTURAL (TOLERANTE)
  -------------------------------- */
  const profileStructural =
    profile
      ? normalizeProfileStructural(profile, ratios, scores)
      : pending('Profile not available in bulk');

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
  const dividendQuality = calculateDividendQuality({
    dividendYield: ratios?.dividendYieldTTM ?? null,
    payoutRatio: ratios?.payoutRatioTTM ?? null,
    fcfPayoutRatio: ratios?.cashFlowCoverageRatiosTTM ? 1 / ratios.cashFlowCoverageRatiosTTM : null, // Approx if inverse
    dividendGrowth: null, // Need growth history
    consecutiveGrowthYears: 0 // Need history
  });

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
     SNAPSHOT FINAL
  -------------------------------- */
  return {
    ticker: sym,
    snapshot_date: today,
    engine_version: 'v2.1', // Bump version

    // 🔴 Persistencia explícita
    sector,

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
