// Fintra/lib/engine/fgos-recompute.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import { applyQualityBrakes } from './applyQualityBrakes';
import { getBenchmarksForSector } from './benchmarks';
import type { FinancialSnapshot, FmpRatios, FmpMetrics, SectorBenchmark, FgosBreakdown, FgosCategory } from './types';
import { calculateConfidenceLayer, type ConfidenceInputs } from './confidence';

type BenchMap = Record<string, SectorBenchmark>;

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
) {
  if (value == null || !stats) return null;
  let raw_percentile: number;
  if (value <= stats.p10) raw_percentile = 10;
  else if (value <= stats.p25) raw_percentile = 25;
  else if (value <= stats.p50) raw_percentile = 50;
  else if (value <= stats.p75) raw_percentile = 75;
  else raw_percentile = 90;
  if (stats.confidence === 'low') {
    const sampleSize = stats.sample_size || 0;
    const weight = Math.min(1, Math.max(0, sampleSize / 20));
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
  items: Array<{ value: number | null | undefined; benchmark: any }>
): { score: number | null; impact?: {
  raw_percentile: number;
  effective_percentile: number;
  sample_size: number;
  weight: number;
  benchmark_low_confidence: true;
} } {
  const results = items
    .map(i => calculateMetricScore(i.value, i.benchmark))
    .filter((r): r is any => r !== null);
  if (!results.length) return { score: null };
  const score = results.reduce((sum, r) => sum + r.effective, 0) / results.length;
  const hasLowConf = results.some(r => r.is_low_conf);
  if (hasLowConf) {
    const rawAvg = results.reduce((sum, r) => sum + r.raw, 0) / results.length;
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

export function computeFGOS(
  ticker: string,
  snapshot: FinancialSnapshot,
  ratios: FmpRatios,
  metrics: FmpMetrics,
  growth: { revenue_cagr?: number | null; earnings_cagr?: number | null; fcf_cagr?: number | null },
  benchmarks: BenchMap | null,
  confidenceInputs: Omit<ConfidenceInputs, 'missing_core_metrics'> | null
): {
  fgos_score: number | null;
  fgos_category: FgosCategory;
  fgos_confidence_percent: number;
  fgos_confidence_label?: 'High' | 'Medium' | 'Low';
  fgos_status: 'computed' | 'pending' | 'Mature' | 'Developing' | 'Early-stage' | 'Incomplete';
  fgos_components: FgosBreakdown;
} {
  const sector = snapshot.sector;
  const profileOk = snapshot.profile_structural && (snapshot as any).profile_structural.status !== 'pending';
  if (!profileOk) {
    return {
      fgos_score: null,
      fgos_category: 'Pending',
      fgos_confidence_percent: 0,
      fgos_confidence_label: 'Low',
      fgos_status: 'pending',
      fgos_components: { growth: null, profitability: null, efficiency: null, solvency: null }
    };
  }
  if (!sector) {
    return {
      fgos_score: null,
      fgos_category: 'Pending',
      fgos_confidence_percent: 0,
      fgos_confidence_label: 'Low',
      fgos_status: 'pending',
      fgos_components: { growth: null, profitability: null, efficiency: null, solvency: null }
    };
  }
  if (!benchmarks || Object.keys(benchmarks).length === 0) {
    return {
      fgos_score: null,
      fgos_category: 'Pending',
      fgos_confidence_percent: 0,
      fgos_confidence_label: 'Low',
      fgos_status: 'pending',
      fgos_components: { growth: null, profitability: null, efficiency: null, solvency: null }
    };
  }
  const hasLowConfidence = Object.values(benchmarks).some(b => b && typeof b === 'object' && (b as any).confidence === 'low');
  const growthResult = calculateComponent([
    { value: growth.revenue_cagr, benchmark: (benchmarks as any).revenue_cagr },
    { value: growth.earnings_cagr, benchmark: (benchmarks as any).earnings_cagr },
    { value: growth.fcf_cagr, benchmark: (benchmarks as any).fcf_cagr }
  ]);
  const profitabilityResult = calculateComponent([
    { value: metrics?.roicTTM, benchmark: (benchmarks as any).roic },
    { value: ratios?.operatingProfitMarginTTM, benchmark: (benchmarks as any).operating_margin },
    { value: ratios?.netProfitMarginTTM, benchmark: (benchmarks as any).net_margin }
  ]);
  const efficiencyResult = calculateComponent([
    { value: metrics?.roicTTM, benchmark: (benchmarks as any).roic },
    { value: metrics?.freeCashFlowMarginTTM, benchmark: (benchmarks as any).fcf_margin }
  ]);
  const solvencyResult = calculateComponent([
    { value: ratios?.debtEquityRatioTTM != null ? 100 - (ratios as any).debtEquityRatioTTM : null, benchmark: (benchmarks as any).debt_to_equity },
    { value: ratios?.interestCoverageTTM, benchmark: (benchmarks as any).interest_coverage }
  ]);
  const WEIGHTS = { growth: 0.25, profitability: 0.30, efficiency: 0.20, solvency: 0.25 };
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
  if (baseScore == null) {
    // Determine confidence/status even if pending? No, if baseScore null, usually means missing critical data.
    // But calculateConfidenceLayer might give useful status like "Incomplete".
    const fgosInputs = [
      growth.revenue_cagr, growth.earnings_cagr, growth.fcf_cagr,
      metrics?.roicTTM, ratios?.operatingProfitMarginTTM, ratios?.netProfitMarginTTM,
      metrics?.freeCashFlowMarginTTM, ratios?.debtEquityRatioTTM, ratios?.interestCoverageTTM
    ];
    const missingCoreMetricsCount = fgosInputs.filter(v => v == null).length;
    const confInputs: ConfidenceInputs = {
      financial_history_years: confidenceInputs?.financial_history_years ?? 5,
      years_since_ipo: confidenceInputs?.years_since_ipo ?? 10,
      earnings_volatility_class: confidenceInputs?.earnings_volatility_class ?? 'MEDIUM',
      missing_core_metrics: missingCoreMetricsCount
    };
    const confidenceResult = calculateConfidenceLayer(confInputs);

    return {
      fgos_score: null,
      fgos_category: 'Pending',
      fgos_confidence_percent: confidenceResult.confidence_percent,
      fgos_confidence_label: confidenceResult.confidence_label,
      fgos_components: {
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
      fgos_status: 'pending' // Or confidenceResult.fgos_status? Usually 'pending' means not computed.
      // If we couldn't compute score, keep it 'pending'.
    };
  }
  const baseFgos = clamp(Math.round(baseScore));
  const brakes = applyQualityBrakes({
    fgosScore: baseFgos,
    altmanZ: metrics?.altmanZScore,
    piotroskiScore: metrics?.piotroskiScore
  });

  /* ---------- CONFIDENCE LAYER (PHASE 2) ---------- */
  const fgosInputs = [
    growth.revenue_cagr, growth.earnings_cagr, growth.fcf_cagr,
    metrics?.roicTTM, ratios?.operatingProfitMarginTTM, ratios?.netProfitMarginTTM,
    metrics?.freeCashFlowMarginTTM, ratios?.debtEquityRatioTTM, ratios?.interestCoverageTTM
  ];
  const missingCoreMetricsCount = fgosInputs.filter(v => v == null).length;
  
  const confInputs: ConfidenceInputs = {
    financial_history_years: confidenceInputs?.financial_history_years ?? 5,
    years_since_ipo: confidenceInputs?.years_since_ipo ?? 10,
    earnings_volatility_class: confidenceInputs?.earnings_volatility_class ?? 'MEDIUM',
    missing_core_metrics: missingCoreMetricsCount
  };

  const confidenceResult = calculateConfidenceLayer(confInputs);

  let category: FgosCategory = 'Medium';
  if (brakes.adjustedScore >= 70) category = 'High';
  else if (brakes.adjustedScore < 40) category = 'Low';

  return {
    fgos_score: brakes.adjustedScore,
    fgos_category: category,
    fgos_confidence_percent: confidenceResult.confidence_percent,
    fgos_confidence_label: confidenceResult.confidence_label,
    fgos_components: {
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
    fgos_status: confidenceResult.fgos_status as any // Cast to match DB field if needed or update return type
  };
}

export async function recomputeFGOSForTicker(ticker: string, snapshotDate?: string) {
  const date = snapshotDate || new Date().toISOString().slice(0, 10);
  
  // 1. Load Snapshot (Strictly persisted fields)
  const { data: snap } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('ticker,snapshot_date,sector,profile_structural,valuation,fundamentals_growth')
    .eq('ticker', ticker)
    .eq('snapshot_date', date)
    .maybeSingle();

  if (!snap) return { status: 'pending', reason: 'snapshot_not_found' };

  // 2. Resolve Sector & Benchmarks (No General fallback)
  const sector = (snap as any).sector || (snap as any).profile_structural?.classification?.sector || null;
  
  if (!sector) {
      await updatePending(ticker, date, 'missing_sector');
      return { status: 'pending', reason: 'missing_sector' };
  }

  const benchmarks = await getBenchmarksForSector(sector, date, false); // allowFallback = false

  if (!benchmarks) {
    await updatePending(ticker, date, 'insufficient_sector_benchmarks');
    return { status: 'pending', reason: 'insufficient_sector_benchmarks' };
  }

  // 3. Fetch Financials (DB only) - Replacing FMP calls
  // We strictly use stored financials, NO external API calls allowed.
  // FIX: Implemented AS-OF logic (period_end_date <= snapshot_date)
  const { data: financials } = await supabaseAdmin
    .from('datos_financieros')
    .select('roic, operating_margin, net_margin, fcf_margin, debt_to_equity, interest_coverage, period_type, period_label, period_end_date')
    .eq('ticker', ticker)
    .in('period_type', ['TTM', 'FY'])
    .lte('period_end_date', date)
    .order('period_end_date', { ascending: false }) // Primary: Latest date
    .order('period_type', { ascending: false }) // Tie-breaker: Prefer TTM
    .limit(1)
    .maybeSingle();

  if (!financials) {
      await updatePending(ticker, date, 'missing_financials_data');
      return { status: 'pending', reason: 'missing_financials_data' };
  }

  console.log(`[FGOS] Resolved Financials for ${ticker} on ${date}:`, {
      ticker,
      period_type: financials.period_type,
      period_label: financials.period_label,
      period_end_date: financials.period_end_date,
      snapshot_date: date
  });

  // 4. Map DB data to Engine Interfaces
  const ratios: FmpRatios = {
      operatingProfitMarginTTM: financials.operating_margin,
      netProfitMarginTTM: financials.net_margin,
      debtEquityRatioTTM: financials.debt_to_equity,
      interestCoverageTTM: financials.interest_coverage
  };

  const metrics: FmpMetrics = {
      roicTTM: financials.roic,
      freeCashFlowMarginTTM: financials.fcf_margin,
      altmanZScore: (snap as any).profile_structural?.financial_scores?.altman_z,
      piotroskiScore: (snap as any).profile_structural?.financial_scores?.piotroski_score
  };

  const growth = (snap as any).fundamentals_growth || {};
  
  // 5. Confidence Inputs (Phase 2)
  // Fetch Financial History (FY count)
  const { data: history } = await supabaseAdmin
    .from('datos_financieros')
    .select('period_end_date, revenue')
    .eq('ticker', ticker)
    .eq('period_type', 'FY')
    .order('period_end_date', { ascending: true });

  const financial_history_years = history ? history.length : 0;

  // Volatility
  let earnings_volatility_class: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (history && history.length >= 3) {
    const revenueGrowth = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].revenue;
      const curr = history[i].revenue;
      if (prev && curr && prev !== 0) {
        revenueGrowth.push((curr - prev) / Math.abs(prev));
      }
    }
    if (revenueGrowth.length >= 2) {
      const mean = revenueGrowth.reduce((a, b) => a + b, 0) / revenueGrowth.length;
      const variance = revenueGrowth.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / revenueGrowth.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev < 0.15) earnings_volatility_class = 'LOW';
      else if (stdDev > 0.40) earnings_volatility_class = 'HIGH';
    }
  }

  // IPO / Years
  let years_since_ipo = 10;
  // Try to find IPO date or Founded date
  const profileStruct = (snap as any).profile_structural;
  const ipoDateStr = profileStruct?.ipoDate || profileStruct?.identity?.founded;
  if (ipoDateStr) {
    const ipo = new Date(ipoDateStr);
    const now = new Date();
    if (!isNaN(ipo.getTime())) {
      years_since_ipo = (now.getTime() - ipo.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    }
  }

  const confidenceInputs: Omit<ConfidenceInputs, 'missing_core_metrics'> = {
    financial_history_years,
    years_since_ipo,
    earnings_volatility_class
  };

  // 6. Compute
  const snapshotRow = {
    ticker: ticker,
    snapshot_date: date,
    sector: sector,
    profile_structural: (snap as any).profile_structural
  } as FinancialSnapshot;

  const result = computeFGOS(ticker, snapshotRow, ratios, metrics, growth, benchmarks, confidenceInputs);

  // 7. Persist
  await supabaseAdmin
    .from('fintra_snapshots')
    .update({ 
        fgos_score: result.fgos_score, 
        fgos_components: result.fgos_components,
        fgos_category: result.fgos_category,
        fgos_confidence_percent: result.fgos_confidence_percent,
        fgos_status: result.fgos_score !== null ? 'computed' : 'pending', // Workflow status
        // Store new Phase 2 fields in JSONB or new columns?
        // Ideally we should have columns. For now I'll put them in fgos_components or extended fields if columns missing.
        // But prompt implies explicit fields. I will try to update them if columns exist (Migration needed).
        // I will assume I create the migration.
        fgos_confidence_label: result.fgos_confidence_label,
        fgos_maturity: result.fgos_status, // Mapping "Mature/Developing..." to fgos_maturity column
        engine_version: 'v3.1-confidence-layer' 
    } as any)
    .eq('ticker', ticker)
    .eq('snapshot_date', date);

  return { status: result.fgos_score !== null ? 'computed' : 'pending', score: result.fgos_score };
}

async function updatePending(ticker: string, date: string, reason: string) {
    await supabaseAdmin
      .from('fintra_snapshots')
      .update({ 
          fgos_score: null, 
          fgos_components: { reason }, 
          fgos_status: 'pending',
          fgos_category: 'Pending'
      })
      .eq('ticker', ticker)
      .eq('snapshot_date', date);
}

