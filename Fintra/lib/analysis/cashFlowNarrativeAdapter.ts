
import { NarrativeAnchor } from './narrativeAnchors';
import { CashFlowSignal } from './cashFlowSignals';

/**
 * Maps cash flow signals to Narrative Anchors.
 * Rules:
 * - Analytical, neutral language
 * - NO mention of "cash", "money", "returns"
 * - Focus on structure, discipline, sustainability
 * - Max 2 narrative anchors
 */
export function mapCashFlowSignalsToNarratives(
  signals: CashFlowSignal[]
): NarrativeAnchor[] {
  if (!signals || signals.length === 0) return [];

  const mappedAnchors: NarrativeAnchor[] = [];
  const seenIds = new Set<string>();

  for (const signal of signals) {
    let anchor: NarrativeAnchor | null = null;

    switch (signal.id) {
      case 'cashflow_consistent':
        anchor = {
          id: 'capital_consistency',
          label: 'Capital generation shows structural consistency',
          tone: 'positive',
          highlight: ['Operational Discipline', 'Internal Funding'],
          when: () => true,
        };
        break;

      case 'cashflow_volatile':
        anchor = {
          id: 'capital_volatility',
          label: 'Internal capital generation appears variable',
          tone: 'warning',
          highlight: ['Operational Stability', 'Funding Predictability'],
          when: () => true,
        };
        break;

      case 'reinvestment_heavy':
        anchor = {
          id: 'capital_deployment_expansion',
          label: 'Capital deployment prioritized for structural expansion',
          tone: 'neutral', // Neutral because it's a strategy choice
          highlight: ['Reinvestment Rate', 'Growth Funding'],
          when: () => true,
        };
        break;

      case 'shareholder_friendly':
        anchor = {
          id: 'capital_allocation_distribution',
          label: 'Capital allocation favors shareholder distribution',
          tone: 'positive',
          highlight: ['Distribution Policy', 'Shareholder Yield'],
          when: () => true,
        };
        break;

      case 'cashflow_pressure':
        anchor = {
          id: 'capital_constraints',
          label: 'Internal funding capacity appears constrained',
          tone: 'negative',
          highlight: ['Funding Sustainability', 'Capital Adequacy'],
          when: () => true,
        };
        break;
    }

    if (anchor && !seenIds.has(anchor.id)) {
      mappedAnchors.push(anchor);
      seenIds.add(anchor.id);
    }

    if (mappedAnchors.length >= 2) break;
  }

  return mappedAnchors;
}
