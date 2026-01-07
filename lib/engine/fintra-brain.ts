// FGOS VERSION 3.1 — BENCHMARK CONFIDENCE AWARE

import "server-only";
import type { FgosResult, FgosBreakdown, FmpProfile, FmpRatios, FmpMetrics } from './types';

import { getBenchmarksForSector } from './benchmarks';
import { applyQualityBrakes } from './applyQualityBrakes';
import { fmp } from '@/lib/fmp/client';

/* ================================
   Helpers
================================ */

function percentileFromStats(
  value: number | null | undefined,
  stats?: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    confidence_level?: 'low' | 'medium' | 'high';
  }
): number | null {
  if (value == null || !stats) return null;

  let score: number;

  if (value <= stats.p10) score = 10;
  else if (value <= stats.p25) score = 25;
  else if (value <= stats.p50) score = 50;
  else if (value <= stats.p75) score = 75;
  else score = 90;

  // Penalización suave por baja confianza
  if (stats.confidence_level === 'low') score *= 0.85;
  if (stats.confidence_level === 'medium') score *= 0.95;

  return score;
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

export function calculateFGOSFromData(
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
): FgosResult | null {
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

    const benchmarks = getBenchmarksForSector(sector);
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

    /* ---------- GROWTH ---------- */
    const growthScore = avg([
      percentileFromStats(growth.revenue_cagr, benchmarks.revenue_cagr),
      percentileFromStats(growth.earnings_cagr, benchmarks.earnings_cagr),
      percentileFromStats(growth.fcf_cagr, benchmarks.fcf_cagr)
    ]);

    /* ---------- PROFITABILITY ---------- */
    const profitabilityScore = avg([
      percentileFromStats(metrics?.roicTTM, benchmarks.roic),
      percentileFromStats(ratios?.operatingProfitMarginTTM, benchmarks.operating_margin),
      percentileFromStats(ratios?.netProfitMarginTTM, benchmarks.net_margin)
    ]);

    /* ---------- EFFICIENCY ---------- */
    const efficiencyScore = avg([
      percentileFromStats(metrics?.roicTTM, benchmarks.roic),
      percentileFromStats(metrics?.freeCashFlowMarginTTM, benchmarks.fcf_margin)
    ]);

    /* ---------- SOLVENCY ---------- */
    const solvencyScore = avg([
      percentileFromStats(
        ratios?.debtEquityRatioTTM != null
          ? 100 - ratios.debtEquityRatioTTM
          : null,
        benchmarks.debt_to_equity
      ),
      percentileFromStats(
        ratios?.interestCoverageTTM,
        benchmarks.interest_coverage
      )
    ]);

    const WEIGHTS = {
      growth: 0.25,
      profitability: 0.30,
      efficiency: 0.20,
      solvency: 0.25
    };

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
          solvency: solvencyScore
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
        solvency: solvencyScore
      } as FgosBreakdown,
      confidence: brakes.confidence,
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

  return calculateFGOSFromData(
    ticker,
    profile as FmpProfile,
    ratios as FmpRatios,
    metrics as FmpMetrics,
    {},
    {}
  );
}
