import { NewsInsight } from './narrativeRisk';

export type NarrativeBias = 'Positivo' | 'Neutro' | 'Negativo';

export interface NarrativeBiasResult {
  bias: NarrativeBias;
  score: number;
  breakdown: {
    positiva: number;
    neutra: number;
    negativa: number;
  };
}

/**
 * Computes the Aggregate Narrative Bias from a set of News Insight snapshots.
 * 
 * This is a deterministic, non-LLM calculation representing the overall
 * directional tilt of the narrative context.
 * 
 * RULES:
 * 1. Consider only provided insights (caller handles time window filtering)
 * 2. Ignore insights with confidence === 'Baja'
 * 3. Direction scores: Positiva (+1), Neutra (0), Negativa (-1)
 * 4. Confidence weighting: Alta (1.0), Media (0.5)
 * 5. Aggregate weighted scores
 * 6. Compute unweighted counts for breakdown
 * 
 * THRESHOLDS:
 * - Score >= +1.5 -> Positivo
 * - Score <= -1.5 -> Negativo
 * - Otherwise     -> Neutro
 * 
 * @param insights Array of News Insights
 * @returns NarrativeBiasResult
 */
export function computeNarrativeBias(insights: NewsInsight[]): NarrativeBiasResult {
  let totalScore = 0;
  const breakdown = {
    positiva: 0,
    neutra: 0,
    negativa: 0
  };

  // Filter and process insights
  for (const insight of insights) {
    // Rule 2: Ignore insights with confidence === 'Baja'
    if (insight.confidence === 'Baja') {
      continue;
    }

    // Rule 3: Assign direction scores
    let directionScore = 0;
    if (insight.direction === 'Positiva') {
      directionScore = 1;
      breakdown.positiva++; // Rule 7: Unweighted count
    } else if (insight.direction === 'Negativa') {
      directionScore = -1;
      breakdown.negativa++;
    } else {
      // Neutra is 0
      breakdown.neutra++;
    }

    // Rule 4: Apply confidence weighting
    let weight = 0;
    if (insight.confidence === 'Alta') {
      weight = 1.0;
    } else if (insight.confidence === 'Media') {
      weight = 0.5;
    }
    // 'Baja' is already filtered out

    // Rule 5: Weighted score for this insight
    const weightedScore = directionScore * weight;

    // Rule 6: Aggregate
    totalScore += weightedScore;
  }

  // Determine Bias based on thresholds
  let bias: NarrativeBias = 'Neutro';
  if (totalScore >= 1.5) {
    bias = 'Positivo';
  } else if (totalScore <= -1.5) {
    bias = 'Negativo';
  }

  // Edge case: empty list or no valid insights results in 0 score and 'Neutro' bias,
  // which is handled by the initialization and default logic above.

  return {
    bias,
    score: totalScore,
    breakdown
  };
}
