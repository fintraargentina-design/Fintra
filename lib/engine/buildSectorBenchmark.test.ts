
import { describe, it, expect } from 'vitest';
import { buildSectorBenchmark } from './buildSectorBenchmark';

describe('buildSectorBenchmark', () => {
  // Case 1: Insufficient Data (< 3)
  it('should return null if sample_size < 3', () => {
    expect(buildSectorBenchmark([])).toBeNull();
    expect(buildSectorBenchmark([10])).toBeNull();
    expect(buildSectorBenchmark([10, 20])).toBeNull();
  });

  // Case 2: Small Sample (3-9) -> Low Confidence + Robust Metrics
  it('should return low confidence and robust metrics for sample_size between 3 and 9', () => {
    // Sample: [10, 20, 30]
    const values = [10, 20, 30];
    const result = buildSectorBenchmark(values);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.sample_size).toBe(3);
    expect(result.confidence).toBe('low');
    
    // Percentiles check (exact calculation depends on logic, but order must hold)
    expect(result.p10).toBeLessThanOrEqual(result.p50);
    expect(result.p50).toBeLessThanOrEqual(result.p90);
    
    // Robust metrics presence
    expect(result.median).toBe(20); // p50 for [10, 20, 30] is 20
    expect(result.trimmed_mean).toBeDefined(); // Should calculate or fallback
    expect(result.uncertainty_range).toBeDefined();
    expect(result.uncertainty_range?.p5).toBeLessThan(result.uncertainty_range?.p95 || 0);
  });

  it('should handle sample_size = 5 correctly', () => {
    // Sample: [1, 2, 3, 4, 5]
    const values = [1, 2, 3, 4, 5];
    const result = buildSectorBenchmark(values);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.sample_size).toBe(5);
    expect(result.confidence).toBe('low');
    expect(result.median).toBe(3);
  });

  it('should handle sample_size = 9 correctly', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = buildSectorBenchmark(values);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.sample_size).toBe(9);
    expect(result.confidence).toBe('low');
  });

  // Case 3: Medium Sample (10-19) -> Medium Confidence
  it('should return medium confidence for sample_size between 10 and 19', () => {
    const values = Array.from({ length: 15 }, (_, i) => i + 1); // 1..15
    const result = buildSectorBenchmark(values);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.sample_size).toBe(15);
    expect(result.confidence).toBe('medium');
    // Robust metrics should be null for larger samples as per current logic
    expect(result.trimmed_mean).toBeNull();
    expect(result.uncertainty_range).toBeNull();
  });

  // Case 4: High Sample (>= 20) -> High Confidence
  it('should return high confidence for sample_size >= 20', () => {
    const values = Array.from({ length: 25 }, (_, i) => i + 1); // 1..25
    const result = buildSectorBenchmark(values);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.sample_size).toBe(25);
    expect(result.confidence).toBe('high');
  });

  // Synthetic Dataset Check
  it('should calculate correct percentiles for known dataset', () => {
    // 0, 10, 20, ... 100 (11 items) -> Medium Confidence
    const values = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = buildSectorBenchmark(values);

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.sample_size).toBe(11);
    expect(result.confidence).toBe('medium');
    
    // Logic: sorted[Math.floor(q * (length - 1))]
    // length = 11, max_index = 10
    // p10: index 1 -> 10
    // p50: index 5 -> 50
    // p90: index 9 -> 90
    
    expect(result.p10).toBe(10);
    expect(result.p50).toBe(50);
    expect(result.p90).toBe(90);
  });
});
