
export interface CrossDomainInsight {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}

/**
 * Pure function to evaluate cross-domain consistency.
 * 
 * Rules:
 * - Pure, deterministic, null-safe, side-effect free
 * - Uses ONLY narrative anchor IDs already active
 * - No numeric values, no scores, no percentages
 * - Max 2 insights
 * - Silent fail if no valid combinations
 */
export function evaluateCrossDomainConsistency(
  narrativeIds: string[]
): CrossDomainInsight[] {
  if (!narrativeIds || narrativeIds.length === 0) {
    return [];
  }

  const insights: CrossDomainInsight[] = [];
  const activeSet = new Set(narrativeIds);

  // Helper to check combination
  const has = (id: string) => activeSet.has(id);

  // --- Rule Set (6-8 rules max) ---

  // 1. income_stability + cashflow_pressure
  // "Income distribution appears stable despite constrained internal funding."
  if (has('income_stability') && has('cashflow_pressure')) {
    insights.push({
      id: 'consistency_income_cashflow_divergence',
      text: "Income distribution appears stable despite constrained internal funding.",
      type: 'neutral'
    });
  }

  // 2. structural_fragility + profitability_solid
  // "Profitability is present but lacks structural persistence."
  if (has('structural_fragility') && (has('profitability_solid') || has('profitability_high'))) {
    insights.push({
      id: 'consistency_profit_structure_mismatch',
      text: "Profitability is present but lacks structural persistence.",
      type: 'neutral'
    });
  }

  // 3. income_growth + payout_eps_stressed
  // "Income expansion relies on elevated capital distribution."
  if (has('income_growth') && has('payout_eps_stressed')) {
    insights.push({
      id: 'consistency_growth_payout_stress',
      text: "Income expansion relies on elevated capital distribution.",
      type: 'negative'
    });
  }

  // 4. cashflow_consistent + income_stability
  // "Capital generation and distribution appear aligned."
  if (has('cashflow_consistent') && has('income_stability')) {
    insights.push({
      id: 'consistency_cashflow_income_aligned',
      text: "Capital generation and distribution appear aligned.",
      type: 'positive'
    });
  }
  
  // 5. growth_aggressive + cashflow_negative
  // "Growth is prioritized over immediate cash generation."
  if (has('growth_aggressive') && has('cashflow_negative')) {
    insights.push({
      id: 'consistency_growth_cashflow_tradeoff',
      text: "Growth is prioritized over immediate cash generation.",
      type: 'neutral'
    });
  }

  // 6. structural_resilient + profitability_low
  // "Structural foundations are solid despite current low profitability."
  if (has('structural_resilient') && has('profitability_low')) {
    insights.push({
      id: 'consistency_structure_profit_divergence',
      text: "Structural foundations are solid despite current low profitability.",
      type: 'positive'
    });
  }

  // 7. margins_expanding + revenue_declining
  // "Efficiency improvements are offsetting top-line contraction."
  if (has('margins_expanding') && has('revenue_declining')) {
    insights.push({
      id: 'consistency_margin_revenue_divergence',
      text: "Efficiency improvements are offsetting top-line contraction.",
      type: 'neutral'
    });
  }

  // Limit to max 2 insights
  return insights.slice(0, 2);
}
