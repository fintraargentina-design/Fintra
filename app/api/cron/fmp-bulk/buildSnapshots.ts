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
  cashflowGrowthRows: any[] = []
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
          null, // financialHistory (Moat pending in bulk)
          null, // performanceRows (Sentiment pending in bulk)
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
     INVESTMENT VERDICT
     (REGLA DURA DE DOMINIO)
  -------------------------------- */
  const investmentVerdict =
    fgosStatus === 'computed' &&
    typeof fgos?.fgos_score === 'number' &&
    valuation
      ? resolveInvestmentVerdict(
          fgos.fgos_score,
          valuation.valuation_status as any
        )
      : pending('Verdict not computable');

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
    engine_version: 'v2.0',

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
    investment_verdict: investmentVerdict,

    data_confidence: {
      has_profile: !!profile,
      has_financials: !!ratios || !!metrics,
      has_valuation: !!valuation,
      has_performance: !!performance,
      has_fgos: fgosStatus === 'computed'
    }
  };
}
