export type SentimentSnapshotLabel = "TTM" | "TTM_1A" | "TTM_3A" | "TTM_5A";

export interface SentimentValuationSnapshot {
  pe_ratio: number | null;
  ev_ebitda: number | null;
  price_to_fcf: number | null;
  price_to_sales: number | null;
}

export type SentimentValuationTimeline = {
  [K in SentimentSnapshotLabel]: SentimentValuationSnapshot | null;
};

export type SentimentBand = "pessimistic" | "neutral" | "optimistic";

export interface SentimentSignals {
  relative_deviation: number | null;
  directional_consistency: number | null;
  rerating_intensity_penalty: number | null;
}

export interface SentimentResult {
  value: number | null;
  band: SentimentBand | null;
  confidence: number | null;
  status: "computed" | "partial" | "pending";
  signals: SentimentSignals;
  components?: any; // Debug-only
}

type MultipleKey = "pe_ratio" | "ev_ebitda" | "price_to_fcf" | "price_to_sales";

interface DeviationsSummary {
  deviations: number[];
  has_long_history: boolean;
}

/**
 * Calculate median of an array of numbers
 *
 * Median is more robust to outliers than mean, making it suitable
 * for financial analysis where extreme values should not skew results.
 *
 * @param arr - Array of numbers
 * @returns Median value, or 0 if array is empty
 *
 * @example
 * calculateMedian([1, 2, 3, 4, 5]) // Returns 3
 * calculateMedian([1, 2, 3, 4]) // Returns 2.5 (average of middle two)
 * calculateMedian([5, 5, 5, 100]) // Returns 5 (vs mean of 28.75)
 */
function calculateMedian(arr: number[]): number {
  if (arr.length === 0) return 0;

  // Sort array in ascending order
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  // If even length, return average of two middle values
  // If odd length, return middle value
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function collectDeviations(
  timeline: SentimentValuationTimeline,
  key: MultipleKey,
): DeviationsSummary {
  const curr = timeline.TTM;
  const h1 = timeline.TTM_1A;
  const h3 = timeline.TTM_3A;
  const h5 = timeline.TTM_5A;

  const values: { label: SentimentSnapshotLabel; value: number | null }[] = [
    { label: "TTM_1A", value: h1 ? h1[key] : null },
    { label: "TTM_3A", value: h3 ? h3[key] : null },
    { label: "TTM_5A", value: h5 ? h5[key] : null },
  ];

  const deviations: number[] = [];

  if (!curr) return { deviations, has_long_history: false };
  const currVal = curr[key];

  if (currVal == null || currVal <= 0) {
    return { deviations, has_long_history: false };
  }

  for (const v of values) {
    if (v.value == null || v.value <= 0) continue;
    const base = v.value;
    if (base === 0) continue;
    const deviation = (currVal - base) / base;
    deviations.push(deviation);
  }

  const hasLong = (h3 && h3[key] != null) || (h5 && h5[key] != null);

  return { deviations, has_long_history: !!hasLong };
}

function scoreMultipleDeviation(summary: DeviationsSummary): {
  score: number | null;
  directional_consistency: number | null;
  intensity_penalty: number | null;
  relative_deviation: number | null;
} {
  const { deviations } = summary;
  if (!deviations.length) {
    return {
      score: null,
      directional_consistency: null,
      intensity_penalty: null,
      relative_deviation: null,
    };
  }

  const CLAMP_DEV = 1.5;
  const baseScores: number[] = [];
  let sumDev = 0;

  for (const d of deviations) {
    const clamped = Math.max(-CLAMP_DEV, Math.min(CLAMP_DEV, d));
    // Normalize: -1.5 -> 0, 0 -> 50, +1.5 -> 100
    const normalized = 50 + (clamped / CLAMP_DEV) * 50;
    baseScores.push(normalized);
    sumDev += d;
  }

  const baseScore = baseScores.reduce((a, b) => a + b, 0) / baseScores.length;
  const medianDeviation = calculateMedian(deviations);

  // Log for debugging (median is more robust to outliers than mean)
  if (deviations.length > 3) {
    const meanDev = sumDev / deviations.length;
    console.log(
      `[SENTIMENT] Deviation - Median: ${medianDeviation.toFixed(4)}, Mean: ${meanDev.toFixed(4)} (count: ${deviations.length})`,
    );
  }

  let pos = 0;
  let neg = 0;
  for (const d of deviations) {
    if (d > 0.05) pos++;
    else if (d < -0.05) neg++;
  }

  let consistencyFactor = 1;
  if (deviations.length === 1) {
    consistencyFactor = 0.7;
  } else if (pos > 0 && neg > 0) {
    consistencyFactor = 0.4;
  } else {
    consistencyFactor = 1;
  }

  const consistencyScore = Math.round(consistencyFactor * 100);

  // Pull score towards 50 if inconsistent
  let scoreAfterConsistency = 50 + (baseScore - 50) * consistencyFactor;

  let maxAbsDev = 0;
  for (const d of deviations) {
    const abs = Math.abs(d);
    if (abs > maxAbsDev) maxAbsDev = abs;
  }

  const MIN_INTENSITY_FACTOR = 0.6;
  let intensityFactor = 1;
  if (maxAbsDev > 0.5) {
    const capped = Math.min(maxAbsDev, 2.5);
    const t = (capped - 0.5) / (2.5 - 0.5);
    intensityFactor = 1 - t * (1 - MIN_INTENSITY_FACTOR);
  }

  const intensityPenaltyScore = Math.round(intensityFactor * 100);

  // Dampen extreme scores if intensity is too high (volatility penalty)
  const finalScore = 50 + (scoreAfterConsistency - 50) * intensityFactor;

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    directional_consistency: consistencyScore,
    intensity_penalty: intensityPenaltyScore,
    relative_deviation: medianDeviation,
  };
}

function determineBand(score: number): SentimentBand {
  if (score >= 60) return "optimistic";
  if (score <= 40) return "pessimistic";
  return "neutral";
}

export function calculateSentiment(
  timeline: SentimentValuationTimeline | null | undefined,
): SentimentResult {
  if (!timeline) {
    return {
      value: null,
      band: null,
      confidence: null,
      status: "pending",
      signals: {
        relative_deviation: null,
        directional_consistency: null,
        rerating_intensity_penalty: null,
      },
    };
  }

  const resultByMultiple: {
    key: MultipleKey;
    score: number | null;
    directional_consistency: number | null;
    intensity_penalty: number | null;
    relative_deviation: number | null;
  }[] = [];

  const multiples: MultipleKey[] = [
    "pe_ratio",
    "ev_ebitda",
    "price_to_fcf",
    "price_to_sales",
  ];

  let hasLongHistory = false;
  let totalDeviations = 0;

  for (const key of multiples) {
    const summary = collectDeviations(timeline, key);
    if (summary.has_long_history) hasLongHistory = true;
    totalDeviations += summary.deviations.length;
    const scored = scoreMultipleDeviation(summary);
    if (scored.score != null) {
      resultByMultiple.push({
        key,
        score: scored.score,
        directional_consistency: scored.directional_consistency,
        intensity_penalty: scored.intensity_penalty,
        relative_deviation: scored.relative_deviation,
      });
    }
  }

  if (!resultByMultiple.length) {
    return {
      value: null,
      band: null,
      confidence: null,
      status: "pending",
      signals: {
        relative_deviation: null,
        directional_consistency: null,
        rerating_intensity_penalty: null,
      },
    };
  }

  let aggregateScore = 0;
  let aggregateRelDev = 0;
  let aggregateConsistency = 0;
  let aggregateIntensity = 0;

  for (const r of resultByMultiple) {
    aggregateScore += r.score || 0;
    if (r.relative_deviation != null) aggregateRelDev += r.relative_deviation;
    if (r.directional_consistency != null)
      aggregateConsistency += r.directional_consistency;
    if (r.intensity_penalty != null) aggregateIntensity += r.intensity_penalty;
  }

  const count = resultByMultiple.length;
  const finalScoreRaw = aggregateScore / count;
  const avgRelDev = aggregateRelDev / count;
  const avgConsistency = aggregateConsistency / count;
  const avgIntensity = aggregateIntensity / count;

  let status: "computed" | "partial" | "pending" = "partial";
  if (hasLongHistory && totalDeviations >= 2) {
    status = "computed";
  } else {
    status = "partial";
  }

  const distinctHorizons = (() => {
    let c = 0;
    if (timeline.TTM_1A) c++;
    if (timeline.TTM_3A) c++;
    if (timeline.TTM_5A) c++;
    return c;
  })();

  const maxSnapshots = 3;
  const maxMultiples = multiples.length;
  const snapshotFactor = Math.min(1, distinctHorizons / maxSnapshots);
  const multipleFactor = Math.min(1, resultByMultiple.length / maxMultiples);

  const baseConfidence = status === "computed" ? 40 : 25;
  const confidence = Math.round(
    baseConfidence * (0.5 * snapshotFactor + 0.5 * multipleFactor),
  );

  const finalScore = Math.round(Math.max(0, Math.min(100, finalScoreRaw)));
  const band = determineBand(finalScore);

  return {
    value: finalScore,
    band,
    confidence,
    status,
    signals: {
      relative_deviation: avgRelDev,
      directional_consistency: isNaN(avgConsistency)
        ? null
        : Math.round(avgConsistency),
      rerating_intensity_penalty: isNaN(avgIntensity)
        ? null
        : Math.round(avgIntensity),
    },
    components: resultByMultiple, // Debug-only
  };
}
