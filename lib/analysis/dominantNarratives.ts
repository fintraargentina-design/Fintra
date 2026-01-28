import { NewsInsight } from './narrativeRisk';

export interface DominantNarrative {
  narrative: string;
  count: number;
  confidence_weight: number;
}

export interface DominantNarrativeResult {
  narratives: DominantNarrative[];
  total_insights: number;
}

/**
 * Computes dominant narratives from a set of News Insight snapshots.
 * 
 * RULES:
 * 1. Consider only insights within the selected time window (caller responsibility, but validated implicitly via input)
 * 2. Ignore insights with confidence === 'Baja'
 * 3. Count occurrences per narrative
 * 4. Apply confidence weighting: 'Alta' -> 1.0, 'Media' -> 0.5
 * 5. Sort by weighted count (descending)
 * 6. Keep only narratives with raw count >= 2
 * 7. Return top 1-3 narratives
 * 
 * @param insights Array of eligible News Insights
 * @returns DominantNarrativeResult
 */
export function computeDominantNarratives(insights: NewsInsight[]): DominantNarrativeResult {
  const narrativesMap = new Map<string, { rawCount: number; weightedCount: number }>();
  let validInsightCount = 0;

  for (const insight of insights) {
    // Rule 2: Ignore insights with confidence === 'Baja'
    if (insight.confidence === 'Baja') {
      continue;
    }

    validInsightCount++;
    const weight = insight.confidence === 'Alta' ? 1.0 : 0.5;

    // Rule 3 & 4: Count occurrences and apply weighting
    for (const narrative of insight.narrative_vector) {
      if (!narrative) continue; // Skip empty strings if any

      const current = narrativesMap.get(narrative) || { rawCount: 0, weightedCount: 0 };
      narrativesMap.set(narrative, {
        rawCount: current.rawCount + 1,
        weightedCount: current.weightedCount + weight
      });
    }
  }

  // Transform map to array for sorting
  const allNarratives: DominantNarrative[] = Array.from(narrativesMap.entries()).map(([narrative, counts]) => ({
    narrative,
    count: counts.rawCount,
    confidence_weight: counts.weightedCount
  }));

  // Rule 7: Sort by weighted count (descending)
  allNarratives.sort((a, b) => b.confidence_weight - a.confidence_weight);

  // Rule 6 & 9: Filter (raw count >= 2) and take top 3
  const topNarratives = allNarratives
    .filter(n => n.count >= 2)
    .slice(0, 3);

  return {
    narratives: topNarratives,
    total_insights: validInsightCount
  };
}
