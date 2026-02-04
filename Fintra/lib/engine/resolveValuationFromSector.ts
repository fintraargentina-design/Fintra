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

function resolvePercentile(value: number, stats: SectorBenchmarkMetric): number | null {
  const points = [
    { p: 10, v: stats.p10 },
    { p: 25, v: stats.p25 },
    { p: 50, v: stats.p50 },
    { p: 75, v: stats.p75 },
    { p: 90, v: stats.p90 }
  ].filter((point) => Number.isFinite(point.v)) as { p: number; v: number }[];

  if (points.length < 2) return null;

  const sorted = points.slice().sort((a, b) => a.v - b.v);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const interpolate = (a: { p: number; v: number }, b: { p: number; v: number }) => {
    if (a.v === b.v) return a.p;
    return a.p + ((value - a.v) * (b.p - a.p)) / (b.v - a.v);
  };

  let percentile: number;

  if (value <= min.v) {
    percentile = interpolate(min, sorted[1]);
  } else if (value >= max.v) {
    percentile = interpolate(sorted[sorted.length - 2], max);
  } else {
    let idx = 0;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      if (value >= sorted[i].v && value <= sorted[i + 1].v) {
        idx = i;
        break;
      }
    }
    percentile = interpolate(sorted[idx], sorted[idx + 1]);
  }

  if (!Number.isFinite(percentile)) return null;
  return Math.min(100, Math.max(0, percentile));
}

export interface ValuationContext {
  fgos_maturity: string | null;
  interpretation_context: {
    dominant_horizons_used: string[];
  };
}

export function buildValuationState(
  input: ValuationInput,
  sectorBenchmarks: SectorBenchmarkMap,
  context?: ValuationContext
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
    // Rule: Use sector distribution percentiles (p10, p25, p50, p75, p90)
    // Logic: Interpolate the real percentile for each metric vs sector benchmarks.
    
    const resolveMetricPercentile = (val: number, benchmarkKey: string) => {
        const bench = sectorBenchmarks[benchmarkKey];
        if (!bench) return null;
        return resolvePercentile(val, bench);
    };

    if (pe !== null) {
        const p = resolveMetricPercentile(pe, 'pe_ratio');
        if (p !== null) percentiles.push(p);
    }
    if (ev !== null) {
        const p = resolveMetricPercentile(ev, 'ev_ebitda');
        if (p !== null) percentiles.push(p);
    }
    if (pfcf !== null) {
        const p = resolveMetricPercentile(pfcf, 'price_to_fcf');
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
    const coveragePercent = Math.round((valid_count / 3) * 100);
    let dispersionRange = 0;
    if (valid_count >= 2) {
      const minP = Math.min(...percentiles);
      const maxP = Math.max(...percentiles);
      dispersionRange = maxP - minP;
    }
    const dispersionPenalty = Math.round((dispersionRange / 100) * 40);
    const confidencePercent = Math.max(0, Math.min(100, coveragePercent - dispersionPenalty));
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
      if (medianPercentile <= 20) {
        valuation_status = 'very_cheap_sector';
      } else if (medianPercentile <= 40) {
        valuation_status = 'cheap_sector';
      } else if (medianPercentile <= 60) {
        valuation_status = 'fair_sector';
      } else if (medianPercentile < 80) {
        valuation_status = 'expensive_sector';
      } else {
        valuation_status = 'very_expensive_sector';
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
       if (valuation_status === 'very_cheap_sector') {
          explanation = 'La empresa cotiza a múltiplos muy inferiores a su sector (Very Cheap).';
       } else if (valuation_status === 'cheap_sector') {
          explanation = 'La empresa cotiza a múltiplos inferiores a su sector (Cheap).';
       } else if (valuation_status === 'expensive_sector') {
          explanation = 'La empresa cotiza a múltiplos superiores a su sector (Expensive).';
       } else if (valuation_status === 'very_expensive_sector') {
          explanation = 'La empresa cotiza a múltiplos muy superiores a su sector (Very Expensive).';
       } else {
          explanation = 'La empresa cotiza en línea con la mediana de su sector (Fair).';
       }

       if (stage === 'partial') {
           explanation = `Valoración preliminar (${valid_count}/3 métricas). ` + explanation;
       }
    }

    // 5. MATURITY AWARENESS LOGIC
    if (context) {
        const { fgos_maturity, interpretation_context } = context;
        const dominant_horizons = interpretation_context?.dominant_horizons_used || [];

        if (fgos_maturity === 'early') {
             // EARLY: Status descriptive_only.
             // Allow percentiles and raw comparables (we keep metrics and percentiles)
             // MUST NOT emit cheap/fair/expensive labels
             valuation_status = 'descriptive_only';
             explanation = 'Empresa en etapa temprana (Early). Se muestran métricas descriptivas sin veredicto de valoración.';
             // Stage remains computed/partial to show we have data, but status is descriptive
        } else if (fgos_maturity === 'developing') {
             // DEVELOPING
             // Requirements: >= 2 valid metrics, Low dispersion, >= 1 dominant horizon >= 1A
             const hasLongHorizon = dominant_horizons.some(h => {
                  if (h.endsWith('Y') || h.endsWith('A')) {
                      const num = parseInt(h);
                      return num >= 1;
                  }
                  return false;
             });

             // "Low dispersion" - reusing dispersionPenalty.
             // dispersionPenalty maps 0-100 range to 0-40 penalty.
             // If range is large (e.g. 50 percentile points), penalty is 20.
             // Let's strict check: dispersionPenalty < 20 means range < 50 percentile points.
             const isLowDispersion = dispersionPenalty < 20;

             if (valid_count < 2 || !isLowDispersion || !hasLongHorizon) {
                 valuation_status = 'pending';
                 stage = 'pending';
                 explanation = 'Requisitos de madurez (Developing) no cumplidos: se requiere historial >1A y baja dispersión de métricas.';
             } else {
                 // Allowed states: potentially_cheap, potentially_expensive, fair
                 if (medianPercentile <= 40) valuation_status = 'potentially_cheap';
                 else if (medianPercentile >= 60) valuation_status = 'potentially_expensive';
                 else valuation_status = 'fair_sector';
                 
                 // Confidence MUST NOT exceed medium
                 if (confidenceLabel === 'High') confidenceLabel = 'Medium';
                 
                 explanation = `Valoración preliminar (Developing). ${explanation}`;
             }
        }
    }

    if (confidenceLabel === 'Low' && stage !== 'pending' && valuation_status !== 'descriptive_only') {
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
  sectorBenchmarks: SectorBenchmarkMap,
  context?: ValuationContext
): {
  valuation_score: number | null;
  valuation_status: ValuationResult['valuation_status'];
  confidence: number;
  warnings: string[];
} {
  const state = buildValuationState(input, sectorBenchmarks, context);

  const canonicalToLegacy: Record<CanonicalValuationStatus, LegacyValuationStatus> = {
    very_cheap_sector: 'undervalued',
    cheap_sector: 'undervalued',
    fair_sector: 'fair',
    expensive_sector: 'overvalued',
    very_expensive_sector: 'overvalued',
    potentially_cheap: 'undervalued',
    potentially_expensive: 'overvalued',
    descriptive_only: 'pending',
    pending: 'pending'
  };

  let score: number | null = null;
  // Allow score for both 'computed' and 'partial' as long as it's not pending
  if (state.valuation_status !== 'pending' && state.valuation_status !== 'descriptive_only') {
    if (state.valuation_status === 'very_cheap_sector' || state.valuation_status === 'cheap_sector' || state.valuation_status === 'potentially_cheap') score = 80;
    else if (state.valuation_status === 'fair_sector') score = 50;
    else if (state.valuation_status === 'expensive_sector' || state.valuation_status === 'very_expensive_sector' || state.valuation_status === 'potentially_expensive') score = 20;
  }

  const legacyStatus: LegacyValuationStatus = canonicalToLegacy[state.valuation_status];

  return {
    valuation_score: score,
    valuation_status: legacyStatus,
    confidence: state.confidence.percent,
    warnings: state.stage === 'pending' ? ['Insufficient valuation data'] : []
  };
}
