/**
 * TTM v2 Canonical Engine
 *
 * PURPOSE:
 * Single source of truth for Trailing Twelve Months (TTM) computation
 *
 * ARCHITECTURE:
 * - Pure deterministic function (NO database access, NO side effects)
 * - Used by both backfill and incremental cron scripts
 * - Guarantees identical results for identical inputs
 *
 * STRICT RULES:
 * - Requires EXACTLY 4 quarters (throws if not)
 * - NULL propagation: If ANY quarter has NULL for a metric → TTM metric is NULL
 * - NEVER treat NULL as zero
 * - EPS = net_income_ttm / shares_outstanding (NEVER sum quarterly EPS)
 * - Net debt computed ONLY from most recent quarter
 * - No prices, no valuation ratios, no database queries
 *
 * USAGE:
 * import { computeTTMv2 } from '@/lib/engine/ttm';
 * const ttm = computeTTMv2(last4Quarters);
 */

export interface QuarterTTMInput {
  period_end_date: string;
  period_label: string;
  revenue: number | null;
  ebitda: number | null;
  net_income: number | null;
  free_cash_flow: number | null;
  shares_outstanding: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
}

export interface TTMMetrics {
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  net_income_ttm: number | null;
  eps_ttm: number | null;
  free_cash_flow_ttm: number | null;
  net_debt: number | null;
}

/**
 * Compute TTM metrics from exactly 4 quarters
 *
 * CRITICAL RULES:
 * 1. quarters.length MUST be exactly 4 (throws otherwise)
 * 2. If ANY quarter has NULL for a metric → that TTM metric is NULL
 * 3. EPS = net_income_ttm / shares_outstanding (NOT sum of quarterly EPS)
 * 4. Net debt computed from most recent quarter only
 * 5. shares_outstanding must be positive, otherwise eps_ttm is NULL
 *
 * @param quarters - Array of exactly 4 quarters in chronological order
 * @returns TTM metrics with NULL propagation
 * @throws Error if quarters.length !== 4
 */
export function computeTTMv2(quarters: QuarterTTMInput[]): TTMMetrics {
  // ENFORCE: Exactly 4 quarters required
  if (quarters.length !== 4) {
    throw new Error(
      `computeTTMv2 requires exactly 4 quarters, got ${quarters.length}`,
    );
  }

  // STRICT NULL PROPAGATION:
  // If ANY quarter has NULL for a metric → TTM metric is NULL
  // NEVER treat NULL as zero

  // Revenue TTM
  let revenue_ttm: number | null = null;
  if (quarters.every((q) => q.revenue != null)) {
    revenue_ttm = quarters.reduce((sum, q) => sum + q.revenue!, 0);
  }

  // EBITDA TTM
  let ebitda_ttm: number | null = null;
  if (quarters.every((q) => q.ebitda != null)) {
    ebitda_ttm = quarters.reduce((sum, q) => sum + q.ebitda!, 0);
  }

  // Net Income TTM
  let net_income_ttm: number | null = null;
  if (quarters.every((q) => q.net_income != null)) {
    net_income_ttm = quarters.reduce((sum, q) => sum + q.net_income!, 0);
  }

  // Free Cash Flow TTM
  let free_cash_flow_ttm: number | null = null;
  if (quarters.every((q) => q.free_cash_flow != null)) {
    free_cash_flow_ttm = quarters.reduce(
      (sum, q) => sum + q.free_cash_flow!,
      0,
    );
  }

  // Use most recent quarter's snapshot values
  const mostRecent = quarters[3];
  const shares_outstanding = mostRecent.shares_outstanding;

  // EPS TTM: MANDATORY CALCULATION
  // eps_ttm = net_income_ttm / shares_outstanding
  // NEVER sum quarterly EPS
  let eps_ttm: number | null = null;
  if (
    net_income_ttm != null &&
    shares_outstanding != null &&
    shares_outstanding > 0
  ) {
    eps_ttm = net_income_ttm / shares_outstanding;
  }

  // Net Debt: Computed ONLY from most recent quarter
  let net_debt: number | null = null;
  if (
    mostRecent.total_debt != null &&
    mostRecent.cash_and_equivalents != null
  ) {
    net_debt = mostRecent.total_debt - mostRecent.cash_and_equivalents;
  }

  return {
    revenue_ttm,
    ebitda_ttm,
    net_income_ttm,
    eps_ttm,
    free_cash_flow_ttm,
    net_debt,
  };
}
