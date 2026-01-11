// Fintra/lib/engine/resolveValuationFromSector.ts

import type { ValuationResult } from './types';

type SectorBenchmarkMetric = {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sample_size?: number;
  confidence?: 'low' | 'medium' | 'high';
};

type SectorBenchmarkMap = Record<string, SectorBenchmarkMetric>;

interface ValuationInput {
  sector: string;
  pe_ratio?: number | null;
  ev_ebitda?: number | null;
  price_to_fcf?: number | null;
}

export function resolveValuationFromSector(
  input: ValuationInput,
  sectorBenchmarks: SectorBenchmarkMap
): {
  valuation_score: number | null;
  valuation_status: ValuationResult['valuation_status'];
  confidence: number;
  warnings: string[];
} {
  const scores: number[] = [];
  const warnings: string[] = [];

  function scoreMetric(
    value: number | null | undefined,
    stats?: SectorBenchmarkMetric,
    inverse = false
  ): number | null {
    if (value == null || !stats) return null;

    let score: number;

    if (value <= stats.p25) score = inverse ? 75 : 90;
    else if (value <= stats.p50) score = inverse ? 60 : 75;
    else if (value <= stats.p75) score = inverse ? 40 : 50;
    else score = inverse ? 20 : 25;

    // Ajuste por baja confianza estadística
    if (stats.confidence === 'low') {
      score *= 0.85;
      warnings.push('Low sector benchmark confidence');
    } else if (stats.confidence === 'medium') {
      score *= 0.95;
    }

    return score;
  }

  const peScore = scoreMetric(
    input.pe_ratio,
    sectorBenchmarks.pe_ratio,
    true
  );

  const evScore = scoreMetric(
    input.ev_ebitda,
    sectorBenchmarks.ev_ebitda,
    true
  );

  const fcfScore = scoreMetric(
    input.price_to_fcf,
    sectorBenchmarks.price_to_fcf,
    true
  );

  if (peScore != null) scores.push(peScore);
  if (evScore != null) scores.push(evScore);
  if (fcfScore != null) scores.push(fcfScore);

  if (!scores.length) {
    return {
      valuation_score: null,
      valuation_status: 'pending',
      confidence: 0,
      warnings: ['Insufficient valuation data']
    };
  }

  const avgScore =
    scores.reduce((a, b) => a + b, 0) / scores.length;

  let status: 'undervalued' | 'fair' | 'overvalued' = 'fair';

  if (avgScore >= 70) status = 'undervalued';
  else if (avgScore < 40) status = 'overvalued';

  // Confidence basada en calidad del benchmark
  const confidence =
    sectorBenchmarks.pe_ratio?.confidence === 'high'
      ? 90
      : sectorBenchmarks.pe_ratio?.confidence === 'medium'
      ? 70
      : 50;

  return {
    valuation_score: Math.round(avgScore),
    valuation_status: status,
    confidence,
    warnings
  };
}
