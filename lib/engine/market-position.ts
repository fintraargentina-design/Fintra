
import { MarketPosition, SectorBenchmark } from './types';
import { getBenchmarksForSector } from './benchmarks';

interface MarketPositionInputs {
  marketCap: number | null | undefined;
  roic: number | null | undefined;
  operatingMargin: number | null | undefined;
  revenueGrowth: number | null | undefined;
}

/**
 * Calculates the market position of a company relative to its sector.
 * 
 * RULES:
 * 1. Uses ONLY existing benchmark percentiles (no smoothing/interpolation).
 * 2. Returns discrete percentiles (10, 25, 50, 75, 90) matching FGOS logic.
 * 3. Status is 'pending' if sector or benchmarks are missing.
 * 4. Confidence is capped if low-confidence benchmarks are used.
 */
export async function calculateMarketPosition(
  ticker: string,
  sector: string | null | undefined,
  inputs: MarketPositionInputs,
  snapshotDate: string
): Promise<MarketPosition> {
  // 1. Guards
  if (!sector) {
    return {
      status: 'pending',
      sector: 'Unknown',
      components: {},
      summary: 'average', // Default fallback for types, but status is pending
      confidence: 'low',
      reasons: ['Sector not defined']
    };
  }

  const benchmarks = await getBenchmarksForSector(sector, snapshotDate);
  if (!benchmarks) {
    return {
      status: 'pending',
      sector,
      components: {},
      summary: 'average',
      confidence: 'low',
      reasons: ['Benchmarks not available for sector']
    };
  }

  const components: MarketPosition['components'] = {};
  const reasons: string[] = [];
  const confidenceImpacts: ('low' | 'medium' | 'high')[] = [];

  // 2. Component Calculation Helper
  const calculatePercentile = (value: number | null | undefined, metricName: string): number | undefined => {
    if (value == null) return undefined;
    const bench = benchmarks[metricName];
    if (!bench) return undefined;

    confidenceImpacts.push(bench.confidence);

    // Discrete buckets (Conservative/FGOS style)
    if (value <= bench.p10) return 10;
    if (value <= bench.p25) return 25;
    if (value <= bench.p50) return 50;
    if (value <= bench.p75) return 75;
    return 90;
  };

  // 3. Compute Components
  // Size
  const marketCapP = calculatePercentile(inputs.marketCap, 'market_cap');
  if (marketCapP !== undefined) {
    components.size = { market_cap_percentile: marketCapP };
  }

  // Profitability
  const roicP = calculatePercentile(inputs.roic, 'roic');
  const opMarginP = calculatePercentile(inputs.operatingMargin, 'operating_margin');

  if (roicP !== undefined || opMarginP !== undefined) {
    components.profitability = {};
    if (roicP !== undefined) components.profitability.roic_percentile = roicP;
    if (opMarginP !== undefined) components.profitability.margin_percentile = opMarginP;
  }

  // Growth
  const growthP = calculatePercentile(inputs.revenueGrowth, 'revenue_cagr');
  if (growthP !== undefined) {
    components.growth = { revenue_growth_percentile: growthP };
  }

  // 4. Status Check
  const hasComponents = Object.keys(components).length > 0;
  if (!hasComponents) {
    return {
      status: 'pending',
      sector,
      components: {},
      summary: 'average',
      confidence: 'low',
      reasons: ['No matching benchmarks found for available data']
    };
  }

  // 5. Summary Derivation
  // Collect all percentiles
  const allPercentiles: number[] = [];
  if (components.size?.market_cap_percentile) allPercentiles.push(components.size.market_cap_percentile);
  if (components.profitability?.roic_percentile) allPercentiles.push(components.profitability.roic_percentile);
  if (components.profitability?.margin_percentile) allPercentiles.push(components.profitability.margin_percentile);
  if (components.growth?.revenue_growth_percentile) allPercentiles.push(components.growth.revenue_growth_percentile);

  const avgP = allPercentiles.reduce((a, b) => a + b, 0) / allPercentiles.length;
  
  let summary: MarketPosition['summary'] = 'average';
  if (avgP >= 75) summary = 'leader';
  else if (avgP >= 60) summary = 'strong';
  else if (avgP <= 25) summary = 'weak';
  else summary = 'average';

  // 6. Confidence Derivation
  let confidence: 'low' | 'medium' | 'high' = 'high';
  
  const lowConfCount = confidenceImpacts.filter(c => c === 'low').length;
  const totalCount = confidenceImpacts.length;

  if (lowConfCount > 0) {
    confidence = 'medium'; // Cap at medium if any low
  }
  
  if (totalCount > 0 && (lowConfCount / totalCount) > 0.5) {
    confidence = 'low'; // Low if majority are low
  }
  
  // Also downgrade if very few data points
  if (allPercentiles.length < 2) {
      if (confidence === 'high') confidence = 'medium';
  }

  return {
    status: 'computed',
    sector,
    components,
    summary,
    confidence,
    reasons: reasons.length ? reasons : undefined
  };
}
