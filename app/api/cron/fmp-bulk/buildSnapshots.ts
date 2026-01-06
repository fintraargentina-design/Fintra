// Fintra/app/api/cron/fmp-bulk/buildSnapshots.ts

import { normalizeValuation } from './normalizeValuation';
import { normalizePerformance } from './normalizePerformance';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { normalizeProfileStructural } from './normalizeProfileStructural';
import { resolveInvestmentVerdict } from '@/lib/engine/resolveInvestmentVerdict';
import { rollingFYGrowth } from '@/lib/utils/rollingGrowth';



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

export function buildSnapshot(
  sym: string,
  profile: any,
  ratios: any,
  metrics: any,
  quote: any,
  _priceChange: any,
  scores: any,
  incomeGrowthRows: any[] = [],
  cashflowGrowthRows: any[] = []
) {
  console.log('🧪 SNAPSHOT START', sym);

  const today = new Date().toISOString().slice(0, 10);

  // 1️⃣ PROFILE (tolerante)
  const profileStructural = profile
    ? normalizeProfileStructural(profile, ratios, scores)
    : pending('Profile not available in bulk');

  // 2️⃣ PERFORMANCE
  const performance = normalizePerformance(
    profile ?? {},
    quote ?? {},
    null,
    metrics ?? {},
    ratios ?? {}
  );

  // 3️⃣ GROWTH REAL
  const fundamentalsGrowth = {
    revenue_cagr: rollingFYGrowth(incomeGrowthRows, 'growthRevenue'),
    earnings_cagr: rollingFYGrowth(incomeGrowthRows, 'growthNetIncome'),
    fcf_cagr: rollingFYGrowth(cashflowGrowthRows, 'growthFreeCashFlow')
  };

  // mínimos obligatorios
  if (!ratios || !Object.keys(ratios).length) {
    return discard(sym, 'missing_ratios');
  }
  if (!metrics || !Object.keys(metrics).length) {
    return discard(sym, 'missing_metrics');
  }

  // 4️⃣ FGOS (PUEDE SER Pending)
  const fgos = calculateFGOSFromData(
    sym,
    profile ?? {},
    ratios,
    metrics,
    fundamentalsGrowth,
    quote
  );

  console.log('🧠 FGOS OUTPUT RAW', { sym, fgos });

  // 5️⃣ VALUATION
  const valuation = normalizeValuation(ratios, profile ?? {});
  const valuationBlock = valuation
    ? {
        score: valuation.valuation_score,
        status: valuation.valuation_status
      }
    : pending('Valuation not available');

  // 6️⃣ VERDICT (solo si confiable)
  const investmentVerdict =
    valuation &&
    fgos &&
    typeof fgos.fgos_score === 'number' &&
    fgos.confidence >= 60
      ? resolveInvestmentVerdict(
          fgos.fgos_score,
          valuation.valuation_status as any
        )
      : pending('Verdict not computable');

  const sector =
  profileStructural?.classification?.sector ?? null;


  // 7️⃣ SNAPSHOT FINAL (DB-COMPATIBLE)
  return {
    ticker: sym,
    snapshot_date: today,
    engine_version: 'v2.0',
    
    sector,

    profile_structural: profileStructural,

    market_snapshot: performance ?? pending('No performance data'),

    fundamentals_growth: fundamentalsGrowth,

    fgos_score: typeof fgos?.fgos_score === 'number' ? fgos.fgos_score : null,

    fgos_components:
      fgos?.fgos_breakdown && Object.keys(fgos.fgos_breakdown).length
        ? fgos.fgos_breakdown
        : pending('FGOS pending'),

    valuation: valuationBlock,

    market_position: pending('Market position model not implemented yet'),

    investment_verdict: investmentVerdict,

    data_confidence: {
      has_profile: !!profile,
      has_growth: Object.values(fundamentalsGrowth).some(v => v != null),
      has_fgos: typeof fgos?.fgos_score === 'number',
      has_valuation: !!valuation,
      has_performance: !!performance
    }
  };
}
