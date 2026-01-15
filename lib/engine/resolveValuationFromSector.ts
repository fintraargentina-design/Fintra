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
    // 1. HARD METRIC VALIDATION
    // A metric is VALID only if:
    // - value is not null/undefined
    // - value is finite
    // - value > 0 (Strictly positive)
    const validate = (val: number | null | undefined) => {
        if (val === null || val === undefined) return null;
        if (!Number.isFinite(val)) return null;
        if (val <= 0) return null; // Discard negative/zero
        return val;
    };

    const pe = validate(input.pe_ratio);
    const ev = validate(input.ev_ebitda);
    const pfcf = validate(input.price_to_fcf);

    const metrics: ValuationMetrics = {
        pe_ratio: pe,
        ev_ebitda: ev,
        price_to_fcf: pfcf,
    };

    const percentiles: number[] = [];
    
    // 2. SECTOR NORMALIZATION & PERCENTILE MAPPING
    // Rule: Use P50 median ONLY.
    // Logic:
    // - If metric < P50 -> "Cheap" (Proxy Percentile: 25)
    // - If metric > P50 -> "Expensive" (Proxy Percentile: 75)
    // - If metric == P50 -> "Fair" (Proxy Percentile: 50)
    
    const resolveProxyPercentile = (val: number, benchmarkKey: string) => {
        const bench = sectorBenchmarks[benchmarkKey];
        if (!bench) return null;
        
        // We strictly use p50 (median)
        const median = bench.p50;
        
        // If benchmark is invalid? (Shouldn't happen if type is correct)
        if (median === undefined || median === null) return null;

        if (val < median) return 25; // Below median -> Cheap
        if (val > median) return 75; // Above median -> Expensive
        return 50; // Exact match
    };

    if (pe !== null) {
        const p = resolveProxyPercentile(pe, 'pe_ratio');
        if (p !== null) percentiles.push(p);
    }
    if (ev !== null) {
        const p = resolveProxyPercentile(ev, 'ev_ebitda');
        if (p !== null) percentiles.push(p);
    }
    if (pfcf !== null) {
        const p = resolveProxyPercentile(pfcf, 'price_to_fcf');
        if (p !== null) percentiles.push(p);
    }
    
    const valid_count = percentiles.length;

    // Stage (pending / partial / computed)
    let stage: ValuationState['stage'] = 'pending';
    
    // STRICT RULE: Minimum 2 metrics required
    if (valid_count < 2) {
        stage = 'pending';
    } else if (valid_count === 2) {
        stage = 'partial';
    } else {
        stage = 'computed'; // 3 metrics
    }

    // Confidence
    const confidencePercent = Math.round((valid_count / 3) * 100);
    let confidenceLabel: 'Low' | 'Medium' | 'High' = 'Low';
    if (confidencePercent < 40) {
      confidenceLabel = 'Low';
    } else if (confidencePercent <= 70) {
      confidenceLabel = 'Medium';
    } else {
      confidenceLabel = 'High';
    }

    // 3. AGGREGATION (Median of valid percentiles)
    let valuation_status: ValuationState['valuation_status'] = 'pending';
    let medianPercentile = 0;

    if (valid_count >= 2) { // Minimum threshold enforcement
      percentiles.sort((a, b) => a - b);
      const mid = Math.floor(percentiles.length / 2);
      if (percentiles.length % 2 !== 0) {
        medianPercentile = percentiles[mid];
      } else {
        medianPercentile = (percentiles[mid - 1] + percentiles[mid]) / 2;
      }

      // 4. CANONICAL STATES
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

    // Explanation
    let explanation = '';
    if (stage === 'pending') {
      explanation =
        'La valoración no puede determinarse aún por falta de métricas comparables suficientes dentro del sector.';
    } else {
       // Logic for explanation text...
       // Keep existing explanation logic but adapted if needed.
       // The existing logic seems fine.
       if (valuation_status === 'cheap_sector') {
          explanation = 'La empresa cotiza a múltiplos inferiores a la mediana de su sector (Cheap).';
       } else if (valuation_status === 'expensive_sector') {
          explanation = 'La empresa cotiza a múltiplos superiores a la mediana de su sector (Expensive).';
       } else {
          explanation = 'La empresa cotiza en línea con la mediana de su sector (Fair).';
       }

       if (stage === 'partial') {
           explanation = `Valoración preliminar (${valid_count}/3 métricas). ` + explanation;
       }
    }

    if (confidenceLabel === 'Low' && stage !== 'pending') {
      explanation += ' Cautela: cobertura limitada de métricas.';
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
  // Allow score for both 'computed' and 'partial' as long as it's not pending
  if (state.valuation_status !== 'pending') {
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
