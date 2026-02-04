
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-only to avoid error in test environment
vi.mock('server-only', () => { return {}; });

// Mock @/lib/fmp/client
vi.mock('@/lib/fmp/client', () => ({
  fmp: {
    profile: vi.fn(),
    ratiosTTM: vi.fn(),
    keyMetricsTTM: vi.fn()
  }
}));

import { calculateFGOSFromData } from './fintra-brain';
import * as benchmarksModule from './benchmarks';

// Mock getBenchmarksForSector
vi.mock('./benchmarks', () => ({
  getBenchmarksForSector: vi.fn()
}));

describe('calculateFGOSFromData - Low Confidence Benchmarks', () => {
  const mockProfile = { sector: 'Technology' };
  const mockRatios = {
    operatingProfitMarginTTM: 0.25, // 25%
    netProfitMarginTTM: 0.20,
    debtEquityRatioTTM: 0.5,
    interestCoverageTTM: 10
  };
  const mockMetrics = {
    roicTTM: 0.15,
    freeCashFlowMarginTTM: 0.15,
    altmanZScore: 3,
    piotroskiScore: 7
  };
  const mockGrowth = {
    revenue_cagr: 0.10,
    earnings_cagr: 0.10,
    fcf_cagr: 0.10
  };

  // Helper to create a mock benchmark stats object
  const createStats = (p50: number, confidence: 'low' | 'medium' | 'high', sampleSize: number = 20) => ({
    p10: p50 * 0.5,
    p25: p50 * 0.75,
    p50: p50,
    p75: p50 * 1.25,
    p90: p50 * 1.5,
    confidence: confidence,
    sample_size: sampleSize
  });

  it('should flag benchmark_low_confidence as true when low confidence benchmarks are used', async () => {
    const mockBenchmarks = {
      revenue_cagr: createStats(0.10, 'low', 5), // Low confidence
      earnings_cagr: createStats(0.10, 'high', 50),
      fcf_cagr: createStats(0.10, 'high', 50),
      roic: createStats(0.15, 'high', 50),
      operating_margin: createStats(0.20, 'high', 50),
      net_margin: createStats(0.15, 'high', 50),
      fcf_margin: createStats(0.15, 'high', 50),
      debt_to_equity: createStats(0.5, 'high', 50),
      interest_coverage: createStats(10, 'high', 50)
    };

    // @ts-ignore
    benchmarksModule.getBenchmarksForSector.mockReturnValue(mockBenchmarks);

    const result = await calculateFGOSFromData(
      'TEST',
      mockProfile,
      mockRatios,
      mockMetrics,
      mockGrowth,
      null,
      {},
      null,
      null,
      '2023-01-01'
    );

    expect(result).not.toBeNull();
    expect(result?.fgos_breakdown.benchmark_low_confidence).toBe(true);
  });

  it('should apply weight dampening for low confidence benchmarks', async () => {
    // Setup: Value matches p90 -> Raw Percentile = 90
    // Low Confidence, Sample Size = 5
    // Weight = 5 / 20 = 0.25
    // Fallback = 50
    // Expected = 90 * 0.25 + 50 * (1 - 0.25) = 22.5 + 50 * 0.75 = 22.5 + 37.5 = 60
    
    const mockBenchmarks = {
      // revenue_cagr: value 0.10 matches p90 of benchmark (0.05) -> Raw 90
      revenue_cagr: {
        p10: 0.01, p25: 0.02, p50: 0.03, p75: 0.04, p90: 0.05,
        confidence: 'low',
        sample_size: 5
      },
      // Set others to null to isolate test or just fill with dummy high confidence
      earnings_cagr: createStats(100, 'high'), // value 0.10 vs p50 100 -> p10 -> 10
      fcf_cagr: createStats(100, 'high'),
      roic: createStats(100, 'high'),
      operating_margin: createStats(100, 'high'),
      net_margin: createStats(100, 'high'),
      fcf_margin: createStats(100, 'high'),
      debt_to_equity: createStats(100, 'high'),
      interest_coverage: createStats(100, 'high')
    };

    // @ts-ignore
    benchmarksModule.getBenchmarksForSector.mockReturnValue(mockBenchmarks);

    const result = await calculateFGOSFromData(
      'TEST',
      mockProfile,
      mockRatios,
      mockMetrics,
      mockGrowth,
      null,
      {},
      null,
      null,
      '2023-01-01'
    );
    
    // We need to inspect the growth score specifically
    // growthScore = avg(revenue_score, earnings_score, fcf_score)
    // revenue_score expected: 60
    // earnings_score: 10 (value 0.10 vs p10 50)
    // fcf_score: 10
    // Avg = (60 + 10 + 10) / 3 = 26.66
    
    // But we can check breakdown directly if we trust the math, 
    // or we can just verify the revenue component implicitly.
    // Actually, let's just make ALL growth metrics low confidence and identical.
    
    const lowConfBenchmarks = {
        ...mockBenchmarks,
        revenue_cagr: { p10:0.01, p25:0.02, p50:0.03, p75:0.04, p90:0.05, confidence: 'low', sample_size: 5 }, // val 0.10 -> raw 90
        earnings_cagr: { p10:0.01, p25:0.02, p50:0.03, p75:0.04, p90:0.05, confidence: 'low', sample_size: 5 }, // val 0.10 -> raw 90
        fcf_cagr: { p10:0.01, p25:0.02, p50:0.03, p75:0.04, p90:0.05, confidence: 'low', sample_size: 5 },    // val 0.10 -> raw 90
    };
    
    // @ts-ignore
    benchmarksModule.getBenchmarksForSector.mockReturnValue(lowConfBenchmarks);
    
    const result2 = await calculateFGOSFromData('TEST', mockProfile, mockRatios, mockMetrics, mockGrowth, null, {}, null, null, '2023-01-01');
    
    // Expected for each: 90 * 0.25 + 50 * 0.75 = 60
    expect(result2?.fgos_breakdown.growth).toBeCloseTo(60);
  });

  it('should NOT flag low confidence if benchmarks are sufficient', async () => {
    const highConfBenchmarks = {
      revenue_cagr: createStats(0.10, 'high', 100),
      earnings_cagr: createStats(0.10, 'high', 100),
      fcf_cagr: createStats(0.10, 'high', 100),
      roic: createStats(0.15, 'high', 100),
      operating_margin: createStats(0.20, 'high', 100),
      net_margin: createStats(0.15, 'high', 100),
      fcf_margin: createStats(0.15, 'high', 100),
      debt_to_equity: createStats(0.5, 'high', 100),
      interest_coverage: createStats(10, 'high', 100)
    };

    // @ts-ignore
    benchmarksModule.getBenchmarksForSector.mockReturnValue(highConfBenchmarks);

    const result = await calculateFGOSFromData(
      'TEST',
      mockProfile,
      mockRatios,
      mockMetrics,
      mockGrowth,
      null,
      {},
      null,
      null,
      '2023-01-01'
    );

    expect(result?.fgos_breakdown.benchmark_low_confidence).toBe(false);
  });

  it('should not change score for high confidence benchmarks', async () => {
    // Value 0.10 vs p90 0.05 -> Raw 90
    const mockBenchmarks = {
        revenue_cagr: { p10:0.01, p25:0.02, p50:0.03, p75:0.04, p90:0.05, confidence: 'high', sample_size: 50 },
        earnings_cagr: { p10:0.01, p25:0.02, p50:0.03, p75:0.04, p90:0.05, confidence: 'high', sample_size: 50 },
        fcf_cagr: { p10:0.01, p25:0.02, p50:0.03, p75:0.04, p90:0.05, confidence: 'high', sample_size: 50 },
        roic: createStats(100, 'high'),
        operating_margin: createStats(100, 'high'),
        net_margin: createStats(100, 'high'),
        fcf_margin: createStats(100, 'high'),
        debt_to_equity: createStats(100, 'high'),
        interest_coverage: createStats(100, 'high')
    };

    // @ts-ignore
    benchmarksModule.getBenchmarksForSector.mockReturnValue(mockBenchmarks);

    const result = await calculateFGOSFromData(
      'TEST',
      mockProfile,
      mockRatios,
      mockMetrics,
      mockGrowth,
      null,
      {},
      null,
      null,
      '2023-01-01'
    );
    
    // Expected: 90 (no change)
    expect(result?.fgos_breakdown.growth).toBe(90);
  });
});
