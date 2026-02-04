// FGOS VERSION 3.1 — BENCHMARK CONFIDENCE AWARE

// import "server-only";
import type { FgosResult, FgosBreakdown, FmpProfile, FmpRatios, FmpMetrics, LowConfidenceImpact } from './types';

import { getBenchmarksForSector } from './benchmarks';
import { applyQualityBrakes } from './applyQualityBrakes';
import { fmp } from '@/lib/fmp/client';

import { calculateConfidenceLayer, calculateDimensionalConfidence, type ConfidenceInputs } from './confidence';
import { calculateMoat, type FinancialHistoryRow } from './moat';
import { calculateSentiment, type SentimentValuationTimeline } from './sentiment';
import { calculateMetricScore, type MetricResult } from './utils/calculateMetricScore';

/* ================================
   Helpers
================================ */

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
  confidenceInputs: Omit<ConfidenceInputs, 'missing_core_metrics'> | null,
  _quote: any,
  financialHistory: FinancialHistoryRow[] | null,
  _valuationTimeline: SentimentValuationTimeline | null,
  snapshotDate: string
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
        confidence_label: 'Low',
        fgos_status: 'Incomplete',
        calculated_at: new Date().toISOString()
      };
    }

    const benchmarks = await getBenchmarksForSector(sector, snapshotDate);
    if (!benchmarks) {
      console.warn(`[FGOS] Pending: No benchmarks for sector '${sector}' on ${snapshotDate}`);
      return {
        ticker,
        fgos_score: null,
        fgos_category: 'Pending',
        fgos_breakdown: {} as FgosBreakdown,
        confidence: 0,
        confidence_label: 'Low',
        fgos_status: 'Incomplete',
        calculated_at: new Date().toISOString()
      };
    }

    // STRICT PRECONDITIONS: Check ALL required metrics
    const REQUIRED_METRICS = [
      'revenue_cagr', 'earnings_cagr', 'fcf_cagr',
      'roic', 'operating_margin', 'net_margin',
      'fcf_margin', 'debt_to_equity', 'interest_coverage'
    ];

    const missingBenchmarks = REQUIRED_METRICS.filter(m => !benchmarks[m]);

    if (missingBenchmarks.length > 0) {
      console.warn(`[FGOS] Pending: Missing benchmarks for ${ticker} (${sector}): ${missingBenchmarks.join(', ')}`);
      return {
        ticker,
        fgos_score: null,
        fgos_category: 'Pending',
        fgos_breakdown: {} as FgosBreakdown,
        confidence: 0,
        confidence_label: 'Low',
        fgos_status: 'Incomplete',
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
    // FIXED: Removed inverted calculation (100 - D/E)
    // Lower D/E ratio = better solvency, calculateMetricScore handles this correctly
    const solvencyResult = calculateComponent([
      {
        value: ratios?.debtEquityRatioTTM,
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

    const validComponents = [
      { score: growthScore, weight: WEIGHTS.growth },
      { score: profitabilityScore, weight: WEIGHTS.profitability },
      { score: efficiencyScore, weight: WEIGHTS.efficiency },
      { score: solvencyScore, weight: WEIGHTS.solvency }
    ].filter(c => c.score != null);

    let baseScore: number | null = null;
    if (validComponents.length > 0) {
      const totalWeightedScore = validComponents.reduce((sum, c) => sum + (c.score as number) * c.weight, 0);
      const totalWeight = validComponents.reduce((sum, c) => sum + c.weight, 0);
      baseScore = totalWeight > 0 ? totalWeightedScore / totalWeight : null;
    }

    /* ---------- MOAT (NEW) ---------- */
    const moatResult = financialHistory
      ? calculateMoat(financialHistory, benchmarks as any)
      : { score: null, status: 'pending', confidence: null } as const;

    /* ---------- CONFIDENCE LAYER (PHASE 2) ---------- */
    // 1. Calculate missing_core_metrics based on inputs used
    const fgosInputs = [
      growth.revenue_cagr, growth.earnings_cagr, growth.fcf_cagr,
      metrics?.roicTTM, ratios?.operatingProfitMarginTTM, ratios?.netProfitMarginTTM,
      metrics?.freeCashFlowMarginTTM, ratios?.debtEquityRatioTTM, ratios?.interestCoverageTTM
    ];
    const missingCoreMetricsCount = fgosInputs.filter(v => v == null).length;

    // 2. Default inputs if not provided (Legacy/Fallback)
    // If confidenceInputs is null, we assume conservative defaults to avoid inflating confidence blindly.
    const confInputs: ConfidenceInputs = {
      financial_history_years: confidenceInputs?.financial_history_years ?? 5, // Default to 5 (neutral)
      years_since_ipo: confidenceInputs?.years_since_ipo ?? 10, // Default to Mature
      earnings_volatility_class: confidenceInputs?.earnings_volatility_class ?? 'MEDIUM',
      missing_core_metrics: missingCoreMetricsCount
    };

    const confidenceResult = calculateConfidenceLayer(confInputs);

    const sentimentResult = calculateSentiment(_valuationTimeline || null);

    // [AUDIT] Override confidence with Dimensional Completeness logic (User Requirement)
    const tempBreakdown = {
      growth: growthScore,
      profitability: profitabilityScore,
      efficiency: efficiencyScore,
      solvency: solvencyScore,
      moat: moatResult.score,
      sentiment: sentimentResult.value
    };
    const dimensionalConfidence = calculateDimensionalConfidence(tempBreakdown);

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
          solvency_impact: solvencyResult.impact,
          moat: null,
          competitive_advantage: {
            score: null,
            band: null,
            confidence: null
          },
          sentiment: sentimentResult.value,
          sentiment_details: {
            value: sentimentResult.value,
            band: sentimentResult.band,
            confidence: sentimentResult.confidence,
            status: sentimentResult.status,
            signals: sentimentResult.signals
          }
        } as FgosBreakdown,
        confidence: dimensionalConfidence.confidence_percent,
        confidence_label: dimensionalConfidence.confidence_label,
        fgos_status: dimensionalConfidence.fgos_status,
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

    // Note: We use the ANALYTICAL confidence from Phase 2, NOT the benchmark-clamped one for the top-level field.
    // However, we preserve the quality brakes on the SCORE itself.

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
        solvency_impact: solvencyResult.impact,
        moat: moatResult.score,
        competitive_advantage: {
          score: moatResult.score,
          band: moatResult.score !== null ? (moatResult.score >= 70 ? 'strong' : moatResult.score < 40 ? 'weak' : 'defendable') : null,
          confidence: moatResult.confidence,
          axes: (moatResult as any).details ? {
            return_persistence: (moatResult as any).details.roic_persistence,
            operating_stability: (moatResult as any).details.margin_stability
          } : undefined,
          years_analyzed: (moatResult as any).details?.years_analyzed
        },
        sentiment: sentimentResult.value,
        sentiment_details: {
          value: sentimentResult.value,
          band: sentimentResult.band,
          confidence: sentimentResult.confidence,
          status: sentimentResult.status,
          signals: sentimentResult.signals
        }
      } as FgosBreakdown,
      confidence: dimensionalConfidence.confidence_percent,
      confidence_label: dimensionalConfidence.confidence_label,
      fgos_status: dimensionalConfidence.fgos_status,
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
  const [profileRes, ratiosRes, metricsRes, incomeRes] = await Promise.allSettled([
    fmp.profile(ticker),
    fmp.ratiosTTM(ticker),
    fmp.keyMetricsTTM(ticker),
    fmp.incomeStatement(ticker, { limit: 20 })
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
  const ratios = ratiosRes.status === 'fulfilled' ? ratiosRes.value?.[0] : {};
  const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.[0] : {};
  const incomeStatements = incomeRes.status === 'fulfilled' && Array.isArray(incomeRes.value) ? incomeRes.value : [];

  // 1. Financial History Years
  const financial_history_years = incomeStatements.length;

  // 2. Years Since IPO
  let years_since_ipo = 10; // Default Mature
  if (profile?.ipoDate) {
    const ipo = new Date(profile.ipoDate);
    const now = new Date();
    if (!isNaN(ipo.getTime())) {
      years_since_ipo = (now.getTime() - ipo.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    }
  }

  // 3. Earnings Volatility Class
  let earnings_volatility_class: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (financial_history_years >= 3) {
    // Sort by date ascending
    const sorted = [...incomeStatements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const revenueGrowth = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].revenue;
      const curr = sorted[i].revenue;
      if (prev && curr && prev !== 0) {
        revenueGrowth.push((curr - prev) / Math.abs(prev));
      }
    }

    if (revenueGrowth.length >= 2) {
      // Simple variance of growth
      const mean = revenueGrowth.reduce((a, b) => a + b, 0) / revenueGrowth.length;
      const variance = revenueGrowth.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / revenueGrowth.length;
      const stdDev = Math.sqrt(variance);

      // Heuristic thresholds for Revenue Growth Volatility
      if (stdDev < 0.15) earnings_volatility_class = 'LOW';
      else if (stdDev > 0.40) earnings_volatility_class = 'HIGH';
    }
  }

  const confidenceInputs: Omit<ConfidenceInputs, 'missing_core_metrics'> = {
    financial_history_years,
    years_since_ipo,
    earnings_volatility_class
  };

  return await calculateFGOSFromData(
    ticker,
    profile as FmpProfile,
    ratios as FmpRatios,
    metrics as FmpMetrics,
    {},
    confidenceInputs,
    {},
    null,
    null,
    new Date().toISOString().slice(0, 10)
  );
}
