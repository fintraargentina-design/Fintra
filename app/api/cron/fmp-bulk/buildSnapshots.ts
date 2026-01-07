// Fintra/app/api/cron/fmp-bulk/buildSnapshots.ts

import { normalizeValuation } from './normalizeValuation';
import { normalizePerformance } from './normalizePerformance';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { calculateMarketPosition } from '@/lib/engine/market-position';
import { normalizeProfileStructural } from './normalizeProfileStructural';
import { resolveInvestmentVerdict } from '@/lib/engine/resolveInvestmentVerdict';
import { rollingFYGrowth } from '@/lib/utils/rollingGrowth';
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
  const fgos =
    sector
      ? await calculateFGOSFromData(
          sym,
          profile ?? {},
          ratios ?? {},
          metrics ?? {},
          fundamentalsGrowth,
          quote ?? {}
        )
      : null;

  const fgosStatus =
    fgos && typeof fgos.fgos_score === 'number'
      ? 'computed'
      : 'pending';

  /* --------------------------------
     VALUATION
  -------------------------------- */
  const valuation = normalizeValuation(ratios, profile);

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
    }
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

    fgos_score: fgos?.fgos_score ?? null,
    fgos_components: fgos?.fgos_breakdown ?? null,

    valuation: valuation,
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
