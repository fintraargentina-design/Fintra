
import { NarrativeAnchor, TemporalHint } from "./narrativeAnchors";
import { TimelineResponse } from "./types";

/**
 * Pure function to evaluate the temporal context of a specific narrative anchor.
 * 
 * Rules:
 * - recent: Signal appears only in the most recent period
 * - persistent: Signal condition is observable across multiple consecutive periods
 * - fading: Signal existed in older periods but is not present in the most recent one
 * 
 * Constraints:
 * - Pure, deterministic, null-safe
 * - Silent fail (return null if insufficient data or unsupported anchor)
 * - No numeric thresholds beyond simple presence/absence logic (or consistent proxies)
 */
export function evaluateTemporalContext(
  anchorId: string,
  timelineData: TimelineResponse
): TemporalHint | null {
  if (!timelineData || !timelineData.metrics || !timelineData.years) {
    return null;
  }

  // Helper to get historical values for a key, sorted by date descending (assuming years are 2024, 2023...)
  // We prioritize TTM if available, then FYs. But TimelineResponse usually has columns by Year.
  // The 'values' in metrics are keyed by column ID (which maps to year/period).
  // We need to extract a sequence of values: [Current, Year-1, Year-2, ...]
  const getValues = (key: string): number[] => {
    const metric = timelineData.metrics.find(m => m.key === key);
    if (!metric) return [];

    // Sort years descending
    const sortedYears = [...timelineData.years].sort((a, b) => b.year - a.year);
    
    // Extract values
    const values: number[] = [];
    for (const y of sortedYears) {
      // Find column for this year. Prefer 'TTM' if column label indicates?
      // Actually TimelineResponse usually groups columns under year.
      // We take the first available value for the year's columns?
      // Usually there is 1 column per year in the simplified timeline.
      // If there are multiple (e.g. Qs), we take the latest.
      const colId = y.columns[0]; // Assume first column is representative (often FY)
      if (!colId) continue;
      
      const valObj = metric.values[colId];
      if (valObj && valObj.value !== null) {
        values.push(valObj.value);
      }
    }
    return values;
  };

  // Check logic helper
  // recent: current passes, history fails
  // persistent: current passes, history passes (at least 1 prior year)
  // fading: current fails, history passes (at least 1 prior year)
  const checkSignal = (
    key: string, 
    condition: (val: number) => boolean
  ): TemporalHint | null => {
    const values = getValues(key);
    if (values.length < 2) return null; // Need at least current + 1 past period

    const current = values[0];
    const history = values.slice(1); // Rest of the years

    const isCurrent = condition(current);
    
    // Check if at least one recent historical period matches (e.g. Year-1)
    // or if we require strictly "multiple consecutive".
    // "persistent: observable across multiple consecutive periods".
    // Let's check Year-1.
    const isHistory = history.length > 0 && condition(history[0]);

    if (isCurrent && isHistory) return "persistent";
    if (isCurrent && !isHistory) return "recent";
    if (!isCurrent && isHistory) return "fading";
    
    return null;
  };

  // --- Anchor Mappings ---

  switch (anchorId) {
    // Profitability
    case "solid-profitability":
      // Proxy: ROE > 15% (consistent with anchor definition)
      // or just "Positive ROE" if strict no-threshold rule?
      // "No numeric thresholds beyond simple presence/absence".
      // Let's use > 0.15 as it's the anchor's intrinsic definition, not a *new* calculation.
      return checkSignal("return_on_equity", v => v > 0.15);
    
    case "structural_profitability":
      return checkSignal("return_on_invested_capital", v => v > 0.10);

    // Margins
    case "margins_expanding":
      // This is a trend anchor.
      // If it's active, it means margins are expanding NOW.
      // "Persistent" expansion?
      // Check if margins were expanding last year too?
      // Hard to check trend of trend without calculus.
      // Let's check if Net Margin is high? No.
      // Skip trend anchors for now to avoid complexity.
      return null;

    // Financial Risk
    case "financial-risk":
    case "requires-caution":
      // Proxy: Interest Coverage < 1.5
      return checkSignal("interest_coverage", v => v < 1.5);
    
    case "increasing-leverage":
       // Proxy: Debt/Equity > 2.0 (High leverage)
       return checkSignal("debt_equity_ratio", v => v > 2.0);

    // Dividends
    case "income_stability":
    case "dividend_consistent":
      // Presence of dividend
      return checkSignal("dividend_yield", v => v > 0);
    
    case "income_growth":
      // Proxy: Dividend Growth? Or just presence of yield?
      // If we check yield > 0, we track existence of dividend.
      // If dividend existed last year -> persistent.
      return checkSignal("dividend_yield", v => v > 0);

    // Cash Flow
    case "capital_consistency":
    case "structural_cash_generation":
      // Positive FCF
      return checkSignal("free_cash_flow", v => v > 0);
    
    case "cashflow_pressure":
    case "capital_constraints":
      // Negative FCF
      return checkSignal("free_cash_flow", v => v < 0);

    // Growth
    case "strong-growth":
      // Revenue Growth > 15%
      return checkSignal("revenue_growth", v => v > 0.15);

    default:
      return null;
  }
}

/**
 * Attaches temporal context to a list of narrative anchors.
 * Preserves original ordering.
 */
export function attachTemporalContext(
  anchors: NarrativeAnchor[],
  timelineData: TimelineResponse
): NarrativeAnchor[] {
  if (!anchors || anchors.length === 0 || !timelineData) {
    return anchors;
  }

  return anchors.map(anchor => {
    // Clone to avoid mutation
    const newAnchor = { ...anchor };
    const hint = evaluateTemporalContext(anchor.id, timelineData);
    
    if (hint) {
      newAnchor.temporal_hint = hint;
    }
    
    return newAnchor;
  });
}
