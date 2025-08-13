import { buildUrl } from './fmpConfig';

const BASE_URL = 'https://financialmodelingprep.com/stable';

// Type definitions for price target data
export interface PriceTargetSummary {
  symbol: string;
  lastMonthCount: number;
  lastMonthAvgPriceTarget: number;
  lastQuarterCount: number;
  lastQuarterAvgPriceTarget: number;
  lastYearCount: number;
  lastYearAvgPriceTarget: number;
  allTimeCount: number;
  allTimeAvgPriceTarget: number;
  publishers: string;
}

export interface PriceTargetConsensus {
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetConsensus: number;
  targetMedian: number;
}

export interface PriceTargetData {
  summary: PriceTargetSummary | null;
  consensus: PriceTargetConsensus | null;
  symbol: string;
}

export interface FormattedPriceTarget {
  symbol: string;
  summary: {
    lastMonthCount: number;
    lastMonthAvgPriceTarget: number;
    lastQuarterCount: number;
    lastQuarterAvgPriceTarget: number;
    lastYearCount: number;
    lastYearAvgPriceTarget: number;
    allTimeCount: number;
    allTimeAvgPriceTarget: number;
    publishers: string[];
  } | null;
  consensus: {
    targetHigh: number;
    targetLow: number;
    targetConsensus: number;
    targetMedian: number;
    upside: number | null;
  } | null;
}

export interface PriceTargetStats {
  analystCount: number;
  priceRange: {
    low: number;
    high: number;
    range: number;
    rangePercentage: number;
  };
  targets: {
    consensus: number;
    median: number;
    lastYear: number;
    lastQuarter: number;
    lastMonth: number;
  };
  coverage: {
    lastMonth: number;
    lastQuarter: number;
    lastYear: number;
    allTime: number;
  };
}

/**
 * Obtiene el resumen de price targets para un símbolo
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @returns Datos del resumen de price targets
 */
export async function getPriceTargetSummary(symbol: string): Promise<PriceTargetSummary | null> {
  if (!symbol || typeof symbol !== 'string') {
    console.error('Symbol is required for price target summary');
    return null;
  }

  const url = buildUrl(`${BASE_URL}/price-target-summary`, { symbol });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error(`Error fetching price target summary for ${symbol}:`, error);
    return null;
  }
}

/**
 * Obtiene el consenso de price targets para un símbolo
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @returns Datos del consenso de price targets
 */
export async function getPriceTargetConsensus(symbol: string): Promise<PriceTargetConsensus | null> {
  if (!symbol || typeof symbol !== 'string') {
    console.error('Symbol is required for price target consensus');
    return null;
  }

  const url = buildUrl(`${BASE_URL}/price-target-consensus`, { symbol });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error(`Error fetching price target consensus for ${symbol}:`, error);
    return null;
  }
}

/**
 * Obtiene tanto el resumen como el consenso de price targets
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @returns Objeto con summary y consensus
 */
export async function getPriceTargetData(symbol: string): Promise<PriceTargetData> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

  try {
    const [summary, consensus] = await Promise.all([
      getPriceTargetSummary(symbol),
      getPriceTargetConsensus(symbol)
    ]);

    return {
      summary,
      consensus,
      symbol
    };
  } catch (error) {
    console.error(`Error fetching price target data for ${symbol}:`, error);
    return {
      summary: null,
      consensus: null,
      symbol
    };
  }
}

/**
 * Formatea los datos de price targets para mostrar
 * @param priceTargetData - Datos de price targets
 * @returns Datos formateados
 */
export function formatPriceTargetForDisplay(priceTargetData: PriceTargetData): FormattedPriceTarget | null {
  if (!priceTargetData) return null;

  const { summary, consensus, symbol } = priceTargetData;

  return {
    symbol,
    summary: summary ? {
      lastMonthCount: summary.lastMonthCount || 0,
      lastMonthAvgPriceTarget: summary.lastMonthAvgPriceTarget || 0,
      lastQuarterCount: summary.lastQuarterCount || 0,
      lastQuarterAvgPriceTarget: summary.lastQuarterAvgPriceTarget || 0,
      lastYearCount: summary.lastYearCount || 0,
      lastYearAvgPriceTarget: summary.lastYearAvgPriceTarget || 0,
      allTimeCount: summary.allTimeCount || 0,
      allTimeAvgPriceTarget: summary.allTimeAvgPriceTarget || 0,
      publishers: summary.publishers ? JSON.parse(summary.publishers) : []
    } : null,
    consensus: consensus ? {
      targetHigh: consensus.targetHigh || 0,
      targetLow: consensus.targetLow || 0,
      targetConsensus: consensus.targetConsensus || 0,
      targetMedian: consensus.targetMedian || 0,
      upside: null // Se calculará con el precio actual
    } : null
  };
}

/**
 * Calcula el upside potencial basado en el price target consensus
 * @param currentPrice - Precio actual de la acción
 * @param targetPrice - Price target consensus
 * @returns Upside en porcentaje
 */
export function calculateUpside(currentPrice: number, targetPrice: number): number {
  if (!currentPrice || !targetPrice || currentPrice <= 0) return 0;
  return ((targetPrice - currentPrice) / currentPrice) * 100;
}

/**
 * Obtiene estadísticas de price targets
 * @param summary - Datos del resumen
 * @param consensus - Datos del consenso
 * @returns Estadísticas calculadas
 */
export function getPriceTargetStats(
  summary: PriceTargetSummary, 
  consensus: PriceTargetConsensus
): PriceTargetStats | null {
  if (!summary || !consensus) return null;

  const range = consensus.targetHigh - consensus.targetLow;
  const rangePercentage = (range / consensus.targetConsensus) * 100;

  return {
    analystCount: summary.lastYearCount || 0,
    priceRange: {
      low: consensus.targetLow,
      high: consensus.targetHigh,
      range: range,
      rangePercentage: rangePercentage
    },
    targets: {
      consensus: consensus.targetConsensus,
      median: consensus.targetMedian,
      lastYear: summary.lastYearAvgPriceTarget,
      lastQuarter: summary.lastQuarterAvgPriceTarget,
      lastMonth: summary.lastMonthAvgPriceTarget
    },
    coverage: {
      lastMonth: summary.lastMonthCount || 0,
      lastQuarter: summary.lastQuarterCount || 0,
      lastYear: summary.lastYearCount || 0,
      allTime: summary.allTimeCount || 0
    }
  };
}