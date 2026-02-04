import { StructuralSignal } from "./structuralConsistency";
import { NarrativeAnchor } from "./narrativeAnchors";

/**
 * Maps structural consistency signals to Narrative Anchors.
 * Rules:
 * - Analytical, neutral language
 * - Max 2 narrative anchors
 * - Tone mapping:
 *   - structural_profitability → positive
 *   - structural_cash_generation → positive
 *   - episodic_performance → warning
 *   - structural_fragility → negative
 */
export function mapStructuralSignalsToNarratives(signals: StructuralSignal[]): NarrativeAnchor[] {
  const narratives: NarrativeAnchor[] = [];

  for (const signal of signals) {
    if (narratives.length >= 2) break;

    let anchor: NarrativeAnchor | null = null;

    switch (signal.id) {
      case "structural_profitability":
        anchor = {
          id: "structural_profitability",
          label: "Profitability appears structurally sustained over time",
          tone: "positive",
          highlight: ["ROIC sustained", "No collapse"],
          when: () => true
        };
        break;

      case "structural_cash_generation":
        anchor = {
          id: "structural_cash_generation",
          label: "Cash generation shows structural persistence",
          tone: "positive",
          highlight: ["Positive FCF"],
          when: () => true
        };
        break;

      case "episodic_performance":
        anchor = {
          id: "episodic_performance",
          label: "Recent performance appears episodic rather than structural",
          tone: "warning",
          highlight: ["High variance", "Weak years"],
          when: () => true
        };
        break;

      case "structural_fragility":
        anchor = {
          id: "structural_fragility",
          label: "Financial profile shows instability across cycles",
          tone: "negative",
          highlight: ["Erratic", "No pattern"],
          when: () => true
        };
        break;
    }

    if (anchor) {
        narratives.push(anchor);
    }
  }

  return narratives;
}
