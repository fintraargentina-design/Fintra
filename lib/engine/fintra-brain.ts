// FGOS VERSION 3.1 — BENCHMARK CONFIDENCE AWARE

// import "server-only";
import type { FgosResult, FgosBreakdown, FmpProfile, FmpRatios, FmpMetrics, LowConfidenceImpact } from './types';

import { getBenchmarksForSector } from './benchmarks';
import { applyQualityBrakes } from './applyQualityBrakes';
import { fmp } from '@/lib/fmp/client';

/* ================================
   Helpers
================================ */

interface MetricResult {
  effective: number;
  raw: number;
  weight: number;
  sample_size: number;
  is_low_conf: boolean;
}

function calculateMetricScore(
  value: number | null | undefined,
  stats?: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    confidence?: 'low' | 'medium' | 'high';
    sample_size?: number;
  }
): MetricResult | null {
  if (value == null || !stats) return null;

  let raw_percentile: number;

  if (value <= stats.p10) raw_percentile = 10;
  else if (value <= stats.p25) raw_percentile = 25;
  else if (value <= stats.p50) raw_percentile = 50;
  else if (value <= stats.p75) raw_percentile = 75;
  else raw_percentile = 90;

  // Rule 1 & 2: Handle Low Confidence
  if (stats.confidence === 'low') {
    const sampleSize = stats.sample_size || 0;
    // Rule 2: Weight factor clamped to max 1
    const weight = Math.min(1, Math.max(0, sampleSize / 20));
    
    // Rule 3: Effective percentile with fallback to median (50)
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

  // Existing Logic: Handle Medium Confidence (legacy adjustment)
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

function calculateComponent(
  items: Array<{ value: number | null | undefined, benchmark: any }>
): { score: number | null, impact?: LowConfidenceImpact } {
  const results = items
    .map(i => calculateMetricScore(i.value, i.benchmark))
    .filter((r): r is MetricResult => r !== null);
  
  if (!results.length) return { score: null };

  const score = results.reduce((sum, r) => sum + r.effective, 0) / results.length;
  
  const hasLowConf = results.some(r => r.is_low_conf);
  
  if (hasLowConf) {
    // Rule 4: Breakdown transparency
    const rawAvg = results.reduce((sum, r) => sum + r.raw, 0) / results.length;
    
    // Report conservative metadata (minimums) to highlight the weak link
    const minSampleSize = Math.min(...results.map(r => r.sample_size));
    const minWeight = Math.min(...results.map(r => r.weight));
    
    return {
      score,
      impact: {
        raw_percentile: rawAvg,
        effective_percentile: score,
        sample_size: minSampleSize,
        weight: minWeight,
        benchmark_low_confidence: true
      }
    };
  }
  
  return { score };
}

function avg(values: Array<number | null>): number | null {
  const valid = values.filter(v => typeof v === 'number') as number[];
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/* ================================
   FGOS CORE
================================ */

export async function calculateFGOSFromData(
  ticker: string,
  profile: any,
  ratios: any,
  metrics: any,
  growth: {
    revenue_cagr?: number | null;
    earnings_cagr?: number | null;
    fcf_cagr?: number | null;
  },
  _quote: any
): Promise<FgosResult | null> {
  try {
    const sector = profile?.sector;
    if (!sector) {
      return {
        ticker,
        fgos_score: null,
        fgos_category: 'Pending',
        fgos_breakdown: {} as FgosBreakdown,
        confidence: 0,
        calculated_at: new Date().toISOString()
      };
    }

    const benchmarks = await getBenchmarksForSector(sector);
    if (!benchmarks) {
      return {
        ticker,
        fgos_score: null,
        fgos_category: 'Pending',
        fgos_breakdown: {} as FgosBreakdown,
        confidence: 0,
        calculated_at: new Date().toISOString()
      };
    }

    const hasLowConfidence = Object.values(benchmarks).some((b: any) => 
      b && typeof b === 'object' && b.confidence === 'low'
    );

    /* ---------- GROWTH ---------- */
    const growthResult = calculateComponent([
      { value: growth.revenue_cagr, benchmark: benchmarks.revenue_cagr },
      { value: growth.earnings_cagr, benchmark: benchmarks.earnings_cagr },
      { value: growth.fcf_cagr, benchmark: benchmarks.fcf_cagr }
    ]);

    /* ---------- PROFITABILITY ---------- */
    const profitabilityResult = calculateComponent([
      { value: metrics?.roicTTM, benchmark: benchmarks.roic },
      { value: ratios?.operatingProfitMarginTTM, benchmark: benchmarks.operating_margin },
      { value: ratios?.netProfitMarginTTM, benchmark: benchmarks.net_margin }
    ]);

    /* ---------- EFFICIENCY ---------- */
    const efficiencyResult = calculateComponent([
      { value: metrics?.roicTTM, benchmark: benchmarks.roic },
      { value: metrics?.freeCashFlowMarginTTM, benchmark: benchmarks.fcf_margin }
    ]);

    /* ---------- SOLVENCY ---------- */
    const solvencyResult = calculateComponent([
      { 
        value: ratios?.debtEquityRatioTTM != null ? 100 - ratios.debtEquityRatioTTM : null, 
        benchmark: benchmarks.debt_to_equity 
      },
      { value: ratios?.interestCoverageTTM, benchmark: benchmarks.interest_coverage }
    ]);

    const WEIGHTS = {
      growth: 0.25,
      profitability: 0.30,
      efficiency: 0.20,
      solvency: 0.25
    };

    const growthScore = growthResult.score;
    const profitabilityScore = profitabilityResult.score;
    const efficiencyScore = efficiencyResult.score;
    const solvencyScore = solvencyResult.score;

    const baseScore = avg([
      growthScore != null ? growthScore * WEIGHTS.growth : null,
      profitabilityScore != null ? profitabilityScore * WEIGHTS.profitability : null,
      efficiencyScore != null ? efficiencyScore * WEIGHTS.efficiency : null,
      solvencyScore != null ? solvencyScore * WEIGHTS.solvency : null
    ]);

    if (baseScore == null) {
      return {
        ticker,
        fgos_score: null,
        fgos_category: 'Pending',
        fgos_breakdown: {
          growth: growthScore,
          profitability: profitabilityScore,
          efficiency: efficiencyScore,
          solvency: solvencyScore,
          benchmark_low_confidence: hasLowConfidence,
          growth_impact: growthResult.impact,
          profitability_impact: profitabilityResult.impact,
          efficiency_impact: efficiencyResult.impact,
          solvency_impact: solvencyResult.impact
        } as FgosBreakdown,
        confidence: 0,
        calculated_at: new Date().toISOString()
      };
    }

    const baseFgos = clamp(Math.round(baseScore));

    /* ---------- QUALITY BRAKES ---------- */
    const brakes = applyQualityBrakes({
      fgosScore: baseFgos,
      altmanZ: metrics?.altmanZScore,
      piotroskiScore: metrics?.piotroskiScore
    });

    // Rule 5: FGOS confidence capping
    let finalConfidence = brakes.confidence;
    const lowConfComponentsCount = [
      growthResult.impact,
      profitabilityResult.impact,
      efficiencyResult.impact,
      solvencyResult.impact
    ].filter(i => i?.benchmark_low_confidence).length;

    if (lowConfComponentsCount > 0) {
      // Cap at Medium (max 79)
      finalConfidence = Math.min(finalConfidence, 79);
      
      if (lowConfComponentsCount > 1) {
        // Cap at Low (max 59)
        finalConfidence = Math.min(finalConfidence, 59);
      }
    }

    let category: 'High' | 'Medium' | 'Low' | 'Pending' = 'Medium';
    if (brakes.adjustedScore >= 70) category = 'High';
    else if (brakes.adjustedScore < 40) category = 'Low';

    return {
      ticker: ticker.toUpperCase(),
      fgos_score: brakes.adjustedScore,
      fgos_category: category,
      fgos_breakdown: {
        growth: growthScore,
        profitability: profitabilityScore,
        efficiency: efficiencyScore,
        solvency: solvencyScore,
        benchmark_low_confidence: hasLowConfidence,
        growth_impact: growthResult.impact,
        profitability_impact: profitabilityResult.impact,
        efficiency_impact: efficiencyResult.impact,
        solvency_impact: solvencyResult.impact
      } as FgosBreakdown,
      confidence: finalConfidence,
      quality_warnings: brakes.warnings,
      calculated_at: new Date().toISOString()
    };

  } catch (err) {
    console.error(`FGOS Error ${ticker}`, err);
    return null;
  }
}

/* ================================
   Legacy Wrapper (NO TOCAR)
================================ */

export async function calculateFGOS(ticker: string): Promise<FgosResult | null> {
  const [profileRes, ratiosRes, metricsRes] = await Promise.allSettled([
    fmp.profile(ticker),
    fmp.ratiosTTM(ticker),
    fmp.keyMetricsTTM(ticker)
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
  const ratios = ratiosRes.status === 'fulfilled' ? ratiosRes.value?.[0] : {};
  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.[0] : {};

  return await calculateFGOSFromData(
    ticker,
    profile as FmpProfile,
    ratios as FmpRatios,
    metrics as FmpMetrics,
    {},
    {}
  );
}
