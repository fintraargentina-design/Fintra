import { NarrativeAnchor, AnchorTone } from "./narrativeAnchors";

type AnchorDomain = "structural" | "financial_risk" | "profitability" | "growth" | "misc";

/**
 * Determines the domain of an anchor based on its ID or other properties.
 */
function getAnchorDomain(anchor: NarrativeAnchor): AnchorDomain {
  const id = anchor.id.toLowerCase();

  // 1. Structural
  if (
    id.includes("structural") ||
    id === "episodic_performance" ||
    id === "long-term-quality"
  ) {
    return "structural";
  }

  // 2. Financial Risk / Cash Pressure
  if (
    id.includes("risk") ||
    id.includes("leverage") ||
    id.includes("caution") ||
    id.includes("pressure") ||
    id.includes("debt") ||
    id.includes("coverage") ||
    id === "demanding-valuation" ||
    id === "weaker-quality"
  ) {
    return "financial_risk";
  }

  // 3. Profitability / Cash Generation
  if (
    id.includes("profitability") ||
    id.includes("quality") || // generic quality usually implies profitability/moat
    id.includes("margin") ||
    id.includes("cash_generation") ||
    id.includes("roic") ||
    id.includes("roe") ||
    id.includes("fcf")
  ) {
    return "profitability";
  }

  // 4. Growth / Dividends
  if (
    id.includes("growth") ||
    id.includes("dividend") ||
    id.includes("income") ||
    id.includes("yield") ||
    id.includes("valuation") || // Positive/Neutral valuation often linked to growth potential or income
    id.includes("momentum")
  ) {
    return "growth";
  }

  return "misc";
}

function getTonePriority(tone: AnchorTone): number {
  switch (tone) {
    case "negative": return 4;
    case "warning": return 3;
    case "positive": return 2;
    case "neutral": return 1;
    default: return 0;
  }
}

function getDomainPriority(domain: AnchorDomain): number {
  switch (domain) {
    case "structural": return 4;
    case "financial_risk": return 3;
    case "profitability": return 2;
    case "growth": return 1;
    default: return 0;
  }
}

/**
 * Compresses narrative anchors to reduce signal fatigue.
 * 
 * Rules:
 * 1. Tone priority: negative > warning > positive > neutral
 * 2. Domain priority: structural > risk > profitability > growth
 * 3. Redundancy: Keep only 1 per (domain, tone) pair
 * 4. Limit: Max 4 anchors
 */
export function compressNarrativeAnchors(anchors: NarrativeAnchor[]): NarrativeAnchor[] {
  if (!anchors || anchors.length === 0) return [];

  // Map to enhanced objects for sorting
  const enhanced = anchors.map(anchor => {
    const domain = getAnchorDomain(anchor);
    return {
      anchor,
      domain,
      tonePriority: getTonePriority(anchor.tone),
      domainPriority: getDomainPriority(domain)
    };
  });

  // Sort by Tone (Desc), then Domain (Desc)
  enhanced.sort((a, b) => {
    if (a.tonePriority !== b.tonePriority) {
      return b.tonePriority - a.tonePriority;
    }
    if (a.domainPriority !== b.domainPriority) {
      return b.domainPriority - a.domainPriority;
    }
    // Stable sort fallback (optional, but good for determinism if input order matters)
    return 0;
  });

  // Deduplicate by (Domain, Tone)
  const seen = new Set<string>();
  const unique: NarrativeAnchor[] = [];

  for (const item of enhanced) {
    const key = `${item.domain}|${item.anchor.tone}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item.anchor);
    }
    
    // Early exit if we have enough candidates? 
    // Wait, better to collect unique ones first, then slice, 
    // to ensure we really have the *highest priority* ones.
    // Since we sorted by priority, the first one we encounter for a key is the best.
  }

  // Limit to max 4
  return unique.slice(0, 4);
}
