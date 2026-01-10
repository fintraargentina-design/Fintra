
import { NarrativeAnchor } from './narrativeAnchors';
import { DividendSignal } from './dividendSignals';

/**
 * Maps dividend signals to Narrative Anchors.
 * Pure, deterministic, null-safe.
 */
export function mapDividendSignalsToNarratives(
  signals: DividendSignal[]
): NarrativeAnchor[] {
  if (!signals || signals.length === 0) return [];

  const mappedAnchors: NarrativeAnchor[] = [];

  // Track unique IDs to prevent duplicates
  const seenIds = new Set<string>();

  for (const signal of signals) {
    let anchor: NarrativeAnchor | null = null;

    switch (signal.id) {
      case 'dividend_consistent':
        anchor = {
          id: 'income_stability',
          label: 'Income distribution shows structural stability',
          tone: 'positive',
          highlight: ['Dividend Stability', 'Payout History'], // Abstract terms, not specific metrics
          when: () => true, // Condition already met by signal presence
        };
        break;

      case 'dividend_growing':
        anchor = {
          id: 'income_growth',
          label: 'Income stream shows gradual expansion',
          tone: 'positive',
          highlight: ['Dividend Growth', 'DPS Trend'],
          when: () => true,
        };
        break;

      case 'payout_eps_stressed':
      case 'payout_fcf_stressed':
        // Both map to income_pressure. Avoid duplicate if both exist.
        if (!seenIds.has('income_pressure')) {
          anchor = {
            id: 'income_pressure',
            label: 'Income distribution puts pressure on capital allocation',
            tone: 'warning',
            highlight: ['Payout Ratio', 'Capital Allocation'],
            when: () => true,
          };
        }
        break;

      case 'dividend_fragile':
        anchor = {
          id: 'income_fragility',
          label: 'Income sustainability appears structurally fragile',
          tone: 'negative',
          highlight: ['Payout Sustainability', 'Cash Flow Coverage'],
          when: () => true,
        };
        break;
    }

    if (anchor && !seenIds.has(anchor.id)) {
      mappedAnchors.push(anchor);
      seenIds.add(anchor.id);
    }

    // Requirement: Max 2 dividend-based narratives returned
    if (mappedAnchors.length >= 2) break;
  }

  return mappedAnchors;
}
