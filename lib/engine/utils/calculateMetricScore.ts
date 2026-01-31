/**
 * FGOS Metric Scoring Utilities
 *
 * Extracted from fintra-brain.ts and fgos-recompute.ts to eliminate duplication.
 * These utilities are responsible for converting raw financial metrics into
 * percentile-based scores with confidence-aware adjustments.
 */

export interface MetricResult {
  effective: number;
  raw: number;
  weight: number;
  sample_size: number;
  is_low_conf: boolean;
}

export interface BenchmarkStats {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  confidence?: 'low' | 'medium' | 'high';
  sample_size?: number;
}

/**
 * Converts a raw metric value to a percentile score based on benchmark statistics.
 *
 * Key features:
 * - Maps value to percentile using benchmark quartiles (p10, p25, p50, p75, p90)
 * - Applies confidence-based adjustments for low-confidence benchmarks
 * - Returns both effective (adjusted) and raw percentile scores
 *
 * @param value - The raw metric value to score
 * @param stats - Benchmark statistics including percentiles and confidence level
 * @returns MetricResult with effective score, or null if value/stats are missing
 */
export function calculateMetricScore(
  value: number | null | undefined,
  stats?: BenchmarkStats
): MetricResult | null {
  if (value == null || !stats) return null;

  let raw_percentile: number;

  // Map value to percentile bucket
  if (value <= stats.p10) raw_percentile = 10;
  else if (value <= stats.p25) raw_percentile = 25;
  else if (value <= stats.p50) raw_percentile = 50;
  else if (value <= stats.p75) raw_percentile = 75;
  else raw_percentile = 90;

  // Handle Low Confidence: Apply weighted fallback to median (50)
  if (stats.confidence === 'low') {
    const sampleSize = stats.sample_size || 0;

    // Weight factor: 0-20 samples → 0.0-1.0 weight
    const weight = Math.min(1, Math.max(0, sampleSize / 20));

    // Blend raw percentile with neutral fallback (50)
    const fallbackValue = 50;
    const effective = raw_percentile * weight + fallbackValue * (1 - weight);

    return {
      effective,
      raw: raw_percentile,
      weight,
      sample_size: sampleSize,
      is_low_conf: true
    };
  }

  // Handle Medium Confidence: Apply 5% penalty (legacy behavior)
  let effective = raw_percentile;
  if (stats.confidence === 'medium') effective *= 0.95;

  return {
    effective,
    raw: raw_percentile,
    weight: 1,
    sample_size: stats.sample_size || 20,
    is_low_conf: false
  };
}

/**
 * Helper: Calculate mean of valid (non-null) numbers
 */
export function mean(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => typeof v === 'number');
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Helper: Calculate standard deviation of valid numbers
 */
export function stdDev(values: Array<number | null>): number | null {
  const avg = mean(values);
  if (avg === null) return null;

  const valid = values.filter((v): v is number => typeof v === 'number');
  if (valid.length < 2) return null;

  const variance = valid.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / valid.length;
  return Math.sqrt(variance);
}

/**
 * Helper: Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Helper: Clamp a score to [0, 100] range
 */
export function clampScore(score: number): number {
  return clamp(score, 0, 100);
}
