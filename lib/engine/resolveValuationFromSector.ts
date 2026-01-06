// Fintra/lib/engine/resolveValuationFromSector.ts

export type ValuationStatus = 'Barata' | 'Justa' | 'Cara';

interface SectorMetricStats {
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}

interface SectorStatsMap {
  [metric: string]: SectorMetricStats;
}

interface ValuationInput {
  sector: string | null;
  pe_ratio?: number | null;
  ev_ebitda?: number | null;
  price_to_fcf?: number | null;
}

/**
 * Dado un valor y los percentiles del sector,
 * devuelve un percentil aproximado (0–100)
 */
function estimatePercentile(
  value: number,
  stats: SectorMetricStats
): number {
  if (!stats || value <= 0) return 50;

  if (stats.p10 !== null && value <= stats.p10) return 10;
  if (stats.p25 !== null && value <= stats.p25) return 25;
  if (stats.p50 !== null && value <= stats.p50) return 50;
  if (stats.p75 !== null && value <= stats.p75) return 75;
  if (stats.p90 !== null && value <= stats.p90) return 90;

  return 95;
}

/**
 * Resuelve valuation relativa al sector.
 * NO usa FGOS. NO usa precios.
 */
export function resolveValuationFromSector(
  input: ValuationInput,
  sectorStats: SectorStatsMap
): {
  valuation_status: ValuationStatus;
  valuation_score: number;
  debug?: any;
} {
  const percentiles: number[] = [];

  if (input.pe_ratio && sectorStats.pe_ratio) {
    percentiles.push(
      estimatePercentile(input.pe_ratio, sectorStats.pe_ratio)
    );
  }

  if (input.ev_ebitda && sectorStats.ev_ebitda) {
    percentiles.push(
      estimatePercentile(input.ev_ebitda, sectorStats.ev_ebitda)
    );
  }

  if (input.price_to_fcf && sectorStats.price_to_fcf) {
    percentiles.push(
      estimatePercentile(input.price_to_fcf, sectorStats.price_to_fcf)
    );
  }

  // Si no hay métricas comparables
  if (percentiles.length === 0) {
    return {
      valuation_status: 'Justa',
      valuation_score: 50,
      debug: { reason: 'No comparable valuation metrics' }
    };
  }

  // Percentil combinado (promedio simple)
  const avgPercentile =
    percentiles.reduce((a, b) => a + b, 0) / percentiles.length;

  let status: ValuationStatus = 'Justa';
  if (avgPercentile <= 25) status = 'Barata';
  else if (avgPercentile >= 75) status = 'Cara';

  // Score: barato = mejor
  const score = Math.round(100 - avgPercentile);

  return {
    valuation_status: status,
    valuation_score: score,
    debug: {
      percentiles,
      avgPercentile
    }
  };
}
