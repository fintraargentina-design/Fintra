// Fintra/lib/engine/resolveValuationFromSector.ts

import type {
  ValuationResult,
  ValuationState,
  ValuationMetrics,
  CanonicalValuationStatus,
  LegacyValuationStatus
} from './types';

// Matching the structure used in benchmarks.ts (assumed) and existing code
export interface SectorBenchmarkMetric {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sample_size?: number;
  confidence?: 'low' | 'medium' | 'high';
}

export type SectorBenchmarkMap = Record<string, SectorBenchmarkMetric>;

export interface ValuationInput {
  sector: string;
  pe_ratio?: number | null;
  ev_ebitda?: number | null;
  price_to_fcf?: number | null;
}

function getApproximatePercentile(value: number, stats: SectorBenchmarkMetric): number {
  if (value <= stats.p10) return 5;
  if (value <= stats.p25) return 17.5;
  if (value <= stats.p50) return 37.5;
  if (value <= stats.p75) return 62.5;
  if (value <= stats.p90) return 82.5;
  return 95;
}

export function buildValuationState(
  input: ValuationInput,
  sectorBenchmarks: SectorBenchmarkMap
): ValuationState {
    const metrics: ValuationMetrics = {
        pe_ratio: input.pe_ratio ?? null,
        ev_ebitda: input.ev_ebitda ?? null,
        price_to_fcf: input.price_to_fcf ?? null,
    };

    const percentiles: number[] = [];
    
    // For valuation metrics (lower is cheaper/better usually for P/E, EV/EBITDA, P/FCF),
    // a LOW value corresponds to a LOW percentile in the distribution.
    // Low percentile = Cheap = Undervalued.
    // High percentile = Expensive = Overvalued.
    
    if (input.pe_ratio != null && sectorBenchmarks['pe_ratio']) {
        percentiles.push(getApproximatePercentile(input.pe_ratio, sectorBenchmarks['pe_ratio']));
    }
    if (input.ev_ebitda != null && sectorBenchmarks['ev_ebitda']) {
        percentiles.push(getApproximatePercentile(input.ev_ebitda, sectorBenchmarks['ev_ebitda']));
    }
    if (input.price_to_fcf != null && sectorBenchmarks['price_to_fcf']) {
        percentiles.push(getApproximatePercentile(input.price_to_fcf, sectorBenchmarks['price_to_fcf']));
    }
    
    const valid_count = percentiles.length;

    // Stage (pending / partial / computed)
    let stage: ValuationState['stage'] = 'pending';
    if (valid_count === 1 || valid_count === 2) stage = 'partial';
    if (valid_count === 3) stage = 'computed';

    // Confidence: only based on coverage
    const confidencePercent = Math.round((valid_count / 3) * 100);
    let confidenceLabel: 'Low' | 'Medium' | 'High' = 'Low';
    if (confidencePercent < 40) {
      confidenceLabel = 'Low';
    } else if (confidencePercent <= 70) {
      confidenceLabel = 'Medium';
    } else {
      confidenceLabel = 'High';
    }

    // Verdict (canonical) based on median percentile
    let valuation_status: ValuationState['valuation_status'] = 'pending';
    let medianPercentile = 0;

    if (stage === 'computed') {
      percentiles.sort((a, b) => a - b);
      const mid = Math.floor(percentiles.length / 2);
      if (percentiles.length % 2 !== 0) {
        medianPercentile = percentiles[mid];
      } else {
        medianPercentile = (percentiles[mid - 1] + percentiles[mid]) / 2;
      }

      if (medianPercentile <= 35) {
        valuation_status = 'cheap_sector';
      } else if (medianPercentile >= 66) {
        valuation_status = 'expensive_sector';
      } else {
        valuation_status = 'fair_sector';
      }
    } else {
      valuation_status = 'pending';
    }

    // Explanation (narrative alignment)
    let explanation = '';
    if (stage === 'pending') {
      explanation =
        'La valoración no puede determinarse aún por falta de métricas comparables suficientes dentro del sector.';
    } else if (stage === 'partial') {
      let bracket: 'BARATA' | 'JUSTA' | 'CARA' = 'JUSTA';
      if (valuation_status === 'cheap_sector') bracket = 'BARATA';
      else if (valuation_status === 'expensive_sector') bracket = 'CARA';

      explanation =
        `La valoración es preliminar. Con la información disponible, la empresa se ubica ${bracket} para su sector, aunque el análisis no cuenta aún con cobertura completa de múltiplos.`;
    } else {
      if (valuation_status === 'cheap_sector') {
        explanation =
          'La empresa cotiza a múltiplos inferiores a la mediana de su sector, lo que sugiere una valoración relativamente baja en comparación con sus pares.';
      } else if (valuation_status === 'fair_sector') {
        explanation =
          'La empresa cotiza en línea con los múltiplos promedio de su sector, reflejando una valoración acorde a su contexto competitivo.';
      } else if (valuation_status === 'expensive_sector') {
        explanation =
          'La empresa cotiza a múltiplos superiores a la mediana de su sector, lo que indica una valoración exigente en relación con sus pares.';
      }
    }

    if (confidenceLabel === 'Low') {
      explanation +=
        ' Este resultado debe interpretarse con cautela debido a la cobertura limitada de métricas comparables.';
    }

    return {
      stage,
      valuation_status,
      confidence: {
        label: confidenceLabel,
        percent: confidencePercent,
        valid_metrics_count: valid_count
      },
      metrics,
      explanation
    };
}

/**
 * Legacy wrapper to maintain compatibility with existing code.
 * @deprecated Use buildValuationState instead.
 */
export function resolveValuationFromSector(
  input: ValuationInput,
  sectorBenchmarks: SectorBenchmarkMap
): {
  valuation_score: number | null;
  valuation_status: ValuationResult['valuation_status'];
  confidence: number;
  warnings: string[];
} {
  const state = buildValuationState(input, sectorBenchmarks);

  const canonicalToLegacy: Record<CanonicalValuationStatus, LegacyValuationStatus> = {
    cheap_sector: 'undervalued',
    fair_sector: 'fair',
    expensive_sector: 'overvalued',
    pending: 'pending'
  };

  let score: number | null = null;
  if (state.stage === 'computed') {
    if (state.valuation_status === 'cheap_sector') score = 80;
    else if (state.valuation_status === 'fair_sector') score = 50;
    else if (state.valuation_status === 'expensive_sector') score = 20;
  }

  const legacyStatus: LegacyValuationStatus = canonicalToLegacy[state.valuation_status];

  return {
    valuation_score: score,
    valuation_status: legacyStatus,
    confidence: state.confidence.percent,
    warnings: state.stage === 'pending' ? ['Insufficient valuation data'] : []
  };
}
