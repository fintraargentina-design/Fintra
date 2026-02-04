import { NarrativeAnchor } from "./narrativeAnchors";

/**
 * Applies narrative precedence rules to determine the dominant anchor.
 * 
 * Rules (Highest to lowest):
 * 1. Temporal: persistent > recent > fading > undefined
 * 2. Domain: structural > financial_risk > cashflow > profitability > growth > dividend
 * 3. Tone: negative > warning > positive > neutral
 * 
 * @param anchors List of narrative anchors
 * @returns List of anchors with dominance field populated
 */
export function applyNarrativePrecedence(anchors: NarrativeAnchor[]): NarrativeAnchor[] {
  if (!anchors || anchors.length === 0) return [];
  
  if (anchors.length === 1) {
    return [{ ...anchors[0], dominance: 'primary' }];
  }

  // 1. Determine priorities for all anchors
  const priorities = anchors.map((anchor, index) => {
    return {
      index,
      temporal: getTemporalPriority(anchor.temporal_hint),
      domain: getDomainPriority(anchor.id),
      tone: getTonePriority(anchor.tone)
    };
  });

  // 2. Find the winner
  // We sort a copy of priorities to find the top one
  // Sort is descending (higher is better)
  priorities.sort((a, b) => {
    if (a.temporal !== b.temporal) return b.temporal - a.temporal;
    if (a.domain !== b.domain) return b.domain - a.domain;
    if (a.tone !== b.tone) return b.tone - a.tone;
    return 0; // Stable
  });

  const winnerIndex = priorities[0].index;

  // 3. Map back to anchors with dominance
  return anchors.map((anchor, idx) => ({
    ...anchor,
    dominance: idx === winnerIndex ? 'primary' : 'secondary'
  }));
}

function getTemporalPriority(hint?: string): number {
  switch (hint) {
    case 'persistent': return 4;
    case 'recent': return 3;
    case 'fading': return 2;
    default: return 1; // undefined
  }
}

function getDomainPriority(id: string): number {
  const lowerId = id.toLowerCase();

  // 1. Structural
  if (lowerId.includes('structural') || lowerId.includes('episodic')) return 6;
  
  // 2. Financial Risk
  if (
    lowerId.includes('risk') || 
    lowerId.includes('leverage') || 
    lowerId.includes('debt') || 
    lowerId.includes('pressure') || 
    lowerId.includes('fragility') || 
    lowerId.includes('solvency') ||
    lowerId.includes('demanding-valuation') // Explicit risk
  ) return 5;

  // 3. Cashflow
  if (lowerId.includes('cash') || lowerId.includes('fcf')) return 4;

  // 4. Profitability
  if (
    lowerId.includes('profitability') || 
    lowerId.includes('margin') || 
    lowerId.includes('roe') || 
    lowerId.includes('roic') ||
    lowerId.includes('quality')
  ) return 3;

  // 5. Growth
  if (
    lowerId.includes('growth') || 
    lowerId.includes('revenue') || 
    lowerId.includes('cagr') || 
    lowerId.includes('valuation') // Neutral/Positive valuation
  ) return 2;

  // 6. Dividend
  if (
    lowerId.includes('dividend') || 
    lowerId.includes('income') || 
    lowerId.includes('yield') || 
    lowerId.includes('payout')
  ) return 1;

  return 0; // Unknown/Misc
}

function getTonePriority(tone: string): number {
  switch (tone) {
    case 'negative': return 4;
    case 'warning': return 3;
    case 'positive': return 2;
    case 'neutral': return 1;
    default: return 0;
  }
}
