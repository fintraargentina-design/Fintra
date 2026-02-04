import { DecisionAnchor } from "./decisionAnchors";

export type PeerContrast = {
  id: string;
  text: string;
  tone: "positive" | "warning" | "neutral" | "negative";
  dimension: "profitability" | "risk" | "valuation" | "growth";
};

/**
 * Pure, deterministic comparison of Decision Anchors.
 * Compares presence/absence of semantic IDs.
 * No numeric calculations.
 */
export function evaluateDecisionPeerContrast(
  mainDecisionAnchors: DecisionAnchor[],
  peerDecisionAnchors: DecisionAnchor[],
  mainNarrativeIds: string[] = [],
  peerNarrativeIds: string[] = []
): PeerContrast[] {
  const contrasts: PeerContrast[] = [];

  // Helper: Check presence
  const has = (anchors: DecisionAnchor[], id: string) => anchors.some(a => a.id === id);
  const hasNarrative = (ids: string[], id: string) => ids.includes(id);

  // 1. Financial Risk (High Priority)
  // "requires-caution" implies risk/leverage issues
  if (has(mainDecisionAnchors, "requires-caution") && !has(peerDecisionAnchors, "requires-caution")) {
    contrasts.push({
      id: "higher-risk",
      text: "Higher financial risk relative to peer",
      tone: "warning",
      dimension: "risk"
    });
  } else if (!has(mainDecisionAnchors, "requires-caution") && has(peerDecisionAnchors, "requires-caution")) {
    contrasts.push({
      id: "lower-risk",
      text: "More stable financial profile than peer",
      tone: "positive",
      dimension: "risk"
    });
  }

  // 2. Profitability / Quality
  // "long-term-quality" implies solid profitability + safety
  if (has(mainDecisionAnchors, "long-term-quality") && !has(peerDecisionAnchors, "long-term-quality")) {
    contrasts.push({
      id: "stronger-quality",
      text: "Stronger long-term quality profile than peer",
      tone: "positive",
      dimension: "profitability"
    });
  } else if (!has(mainDecisionAnchors, "long-term-quality") && has(peerDecisionAnchors, "long-term-quality")) {
    contrasts.push({
      id: "weaker-quality",
      text: "Quality profile weaker relative to peer",
      tone: "warning",
      dimension: "profitability"
    });
  }

  // 3. Valuation
  // "entry-sensitive-valuation" implies demanding valuation
  if (has(mainDecisionAnchors, "entry-sensitive-valuation") && !has(peerDecisionAnchors, "entry-sensitive-valuation")) {
    contrasts.push({
      id: "more-demanding",
      text: "More demanding valuation than peer",
      tone: "neutral", // Valuation is context-dependent
      dimension: "valuation"
    });
  } else if (!has(mainDecisionAnchors, "entry-sensitive-valuation") && has(peerDecisionAnchors, "entry-sensitive-valuation")) {
    contrasts.push({
      id: "more-attractive-val",
      text: "Valuation potentially more attractive",
      tone: "positive",
      dimension: "valuation"
    });
  }

  // 4. Dividend Contrasts (Narrative ID based)
  const dividendContrasts: PeerContrast[] = [];

  // 4a. Income Stability
  if (hasNarrative(mainNarrativeIds, "income_stability") && !hasNarrative(peerNarrativeIds, "income_stability")) {
    dividendContrasts.push({
      id: "div-stability-better",
      text: "More stable income distribution than peer",
      tone: "positive",
      dimension: "risk" // Stability is risk/quality
    });
  } else if (!hasNarrative(mainNarrativeIds, "income_stability") && hasNarrative(peerNarrativeIds, "income_stability")) {
    dividendContrasts.push({
      id: "div-stability-worse",
      text: "Peer shows more stable income distribution",
      tone: "warning",
      dimension: "risk"
    });
  }

  // 4b. Income Fragility
  if (hasNarrative(mainNarrativeIds, "income_fragility") && !hasNarrative(peerNarrativeIds, "income_fragility")) {
    dividendContrasts.push({
      id: "div-fragility-worse",
      text: "Income sustainability weaker than peer",
      tone: "negative",
      dimension: "risk"
    });
  } else if (!hasNarrative(mainNarrativeIds, "income_fragility") && hasNarrative(peerNarrativeIds, "income_fragility")) {
    dividendContrasts.push({
      id: "div-fragility-better",
      text: "Peer income sustainability appears weaker",
      tone: "positive",
      dimension: "risk"
    });
  }

  // 4c. Income Pressure
  if (hasNarrative(mainNarrativeIds, "income_pressure") && !hasNarrative(peerNarrativeIds, "income_pressure")) {
    dividendContrasts.push({
      id: "div-pressure-worse",
      text: "Higher capital allocation pressure than peer",
      tone: "warning",
      dimension: "risk"
    });
  } else if (!hasNarrative(mainNarrativeIds, "income_pressure") && hasNarrative(peerNarrativeIds, "income_pressure")) {
    dividendContrasts.push({
      id: "div-pressure-better",
      text: "Peer faces higher capital allocation pressure",
      tone: "positive",
      dimension: "risk"
    });
  }

  // Limit dividend contrasts to 2
  const selectedDividendContrasts = dividendContrasts.slice(0, 2);
  contrasts.push(...selectedDividendContrasts);

  // 5. Mixed Signals (Lower Priority)
  if (has(mainDecisionAnchors, "mixed-signals") && !has(peerDecisionAnchors, "mixed-signals") && !has(mainDecisionAnchors, "long-term-quality")) {
    contrasts.push({
      id: "more-uncertainty",
      text: "More mixed signals compared to peer",
      tone: "neutral",
      dimension: "profitability"
    });
  }

  // Limit to 3 total
  return contrasts.slice(0, 3);
}
