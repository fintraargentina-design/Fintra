
import { SectorBenchmark } from './types';

/**
 * Constructs a SectorBenchmark object from a list of numerical values.
 * 
 * Logic:
 * - Returns null if sample_size < 3.
 * - If 3 <= sample_size < 10: Returns "low" confidence with robust metrics (median, trimmed_mean, uncertainty_range).
 * - If sample_size >= 10: Returns "medium" or "high" confidence with standard percentiles.
 * 
 * @param values Array of numbers to analyze
 * @returns SectorBenchmark object or null if insufficient data
 */
export function buildSectorBenchmark(values: number[]): SectorBenchmark | null {
  const count = values.length;
  if (count < 3) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const p = (q: number) => sorted[Math.floor(q * (sorted.length - 1))];

  // Base percentiles (calculated for all valid benchmarks)
  const p10 = p(0.1);
  const p25 = p(0.25);
  const p50 = p(0.5);
  const p75 = p(0.75);
  const p90 = p(0.9);

  let confidence: 'low' | 'medium' | 'high' = 'high';
  let median: number | null = null;
  let trimmedMean: number | null = null;
  let uncertaintyRange: { p5: number; p95: number } | null = null;

  if (count < 10) {
    confidence = 'low';
    // Robust metrics for small samples
    median = p50;
    trimmedMean = calculateTrimmedMean(sorted);
    uncertaintyRange = bootstrapUncertainty(sorted);
  } else if (count < 20) {
    confidence = 'medium';
  } else {
    confidence = 'high';
  }

  return {
    sample_size: count,
    confidence,
    p10,
    p25,
    p50,
    p75,
    p90,
    median,
    trimmed_mean: trimmedMean,
    uncertainty_range: uncertaintyRange
  };
}

/**
 * Calculates a trimmed mean (default 10% trim from each end).
 * Falls back to median if sample size is too small for trimming.
 */
function calculateTrimmedMean(sortedValues: number[], trimPercent: number = 0.1): number {
  const n = sortedValues.length;
  const trimCount = Math.floor(n * trimPercent);
  
  if (trimCount * 2 >= n) {
    // Fallback to median if trimming would remove everything
    return sortedValues[Math.floor(n / 2)]; 
  }
  
  const trimmed = sortedValues.slice(trimCount, n - trimCount);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return sum / trimmed.length;
}

/**
 * Estimates uncertainty using bootstrap resampling (500 iterations).
 * Returns p5 and p95 of the bootstrap means.
 */
function bootstrapUncertainty(values: number[], iterations: number = 500): { p5: number; p95: number } | null {
  if (values.length < 2) return null;
  
  const means: number[] = [];
  const n = values.length;
  
  for (let i = 0; i < iterations; i++) {
    let sampleSum = 0;
    for (let j = 0; j < n; j++) {
      const randomIndex = Math.floor(Math.random() * n);
      sampleSum += values[randomIndex];
    }
    means.push(sampleSum / n);
  }
  
  means.sort((a, b) => a - b);
  const p5 = means[Math.floor(0.05 * (means.length - 1))];
  const p95 = means[Math.floor(0.95 * (means.length - 1))];
  
  return { p5, p95 };
}
