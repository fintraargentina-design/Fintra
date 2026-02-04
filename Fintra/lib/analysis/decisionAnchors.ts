
export type DecisionTone = "positive" | "warning" | "neutral";

export type DecisionAnchor = {
  id: string;
  label: string;
  tone: DecisionTone;
  iconName: "check-circle" | "alert-triangle" | "info" | "scale"; // Mapping for UI icons
  /**
   * Receives the list of ACTIVE narrative anchor IDs
   * Returns true if this decision anchor should activate
   */
  when: (activeNarratives: string[]) => boolean;
};

export const decisionAnchors: DecisionAnchor[] = [
  {
    id: "long-term-quality",
    label: "Candidato de calidad a largo plazo",
    tone: "positive",
    iconName: "check-circle",
    when: (active) => 
      active.includes("solid-profitability") && 
      !active.includes("financial-risk")
  },
  {
    id: "entry-sensitive-valuation",
    label: "Entrada sensible a valoración",
    tone: "warning",
    iconName: "alert-triangle",
    when: (active) => 
      active.includes("demanding-valuation")
  },
  {
    id: "requires-caution",
    label: "Requiere precaución financiera",
    tone: "warning",
    iconName: "alert-triangle",
    when: (active) => 
      active.includes("financial-risk") || 
      active.includes("increasing-leverage")
  },
  {
    id: "mixed-signals",
    label: "Señales mixtas — caso de monitoreo",
    tone: "neutral",
    iconName: "scale",
    when: (active) => {
      // More than one narrative anchor is active
      if (active.length <= 1) return false;
      
      // But none of the positive conditions dominate (solid-profitability is the main positive driver)
      // If solid-profitability is present, it's likely a quality case (maybe with valuation issues), 
      // so we let the other anchors handle it.
      // "Mixed signals" implies we have conflicting info without a clear quality thesis.
      return !active.includes("solid-profitability");
    }
  }
];

export function evaluateDecisionAnchors(
  allAnchors: DecisionAnchor[],
  activeNarratives: string[]
): DecisionAnchor[] {
  // 1. Evaluate all anchors
  const activeDecisions = allAnchors.filter(anchor => anchor.when(activeNarratives));

  // 2. Sort by priority: positive -> warning -> neutral
  const tonePriority: Record<DecisionTone, number> = {
    "positive": 1,
    "warning": 2,
    "neutral": 3
  };

  activeDecisions.sort((a, b) => tonePriority[a.tone] - tonePriority[b.tone]);

  // 3. Return at most 2 anchors
  return activeDecisions.slice(0, 2);
}
