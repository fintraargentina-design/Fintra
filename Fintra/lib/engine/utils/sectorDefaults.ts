/**
 * Sector-Specific Default Values
 *
 * Provides contextual fallback values for financial metrics when
 * sector benchmarks are unavailable. These values are research-backed
 * estimates based on historical sector performance.
 *
 * Sources:
 * - Damodaran Industry Data (NYU Stern)
 * - S&P Capital IQ sector averages
 * - Historical 10-year medians
 */

export interface SectorDefaults {
  roic: number;         // Return on Invested Capital (median %)
  grossMargin: number;  // Gross Profit Margin (median %)
  netMargin: number;    // Net Profit Margin (median %)
  debtToEquity: number; // Debt/Equity Ratio (median)
}

/**
 * Default financial metrics by sector
 * Values represent conservative median estimates
 */
export const SECTOR_DEFAULTS: Record<string, SectorDefaults> = {
  // Technology - High margins, moderate ROIC
  'Technology': {
    roic: 0.15,         // 15%
    grossMargin: 0.60,  // 60%
    netMargin: 0.15,    // 15%
    debtToEquity: 0.30  // 0.3x
  },

  // Healthcare - High margins, high ROIC
  'Healthcare': {
    roic: 0.12,
    grossMargin: 0.65,
    netMargin: 0.12,
    debtToEquity: 0.40
  },

  // Financials - Low margins, moderate ROIC
  'Financial Services': {
    roic: 0.08,
    grossMargin: 0.45,
    netMargin: 0.18,
    debtToEquity: 1.50  // Banks naturally have higher leverage
  },

  'Financial': { // Alias
    roic: 0.08,
    grossMargin: 0.45,
    netMargin: 0.18,
    debtToEquity: 1.50
  },

  // Consumer Discretionary - Moderate margins
  'Consumer Cyclical': {
    roic: 0.10,
    grossMargin: 0.35,
    netMargin: 0.06,
    debtToEquity: 0.60
  },

  'Consumer Defensive': {
    roic: 0.12,
    grossMargin: 0.30,
    netMargin: 0.05,
    debtToEquity: 0.50
  },

  // Energy - Volatile, capital intensive
  'Energy': {
    roic: 0.06,
    grossMargin: 0.25,
    netMargin: 0.08,
    debtToEquity: 0.70
  },

  // Utilities - Low margins, regulated
  'Utilities': {
    roic: 0.05,
    grossMargin: 0.40,
    netMargin: 0.10,
    debtToEquity: 1.20  // High leverage due to infrastructure
  },

  // Industrials - Moderate across the board
  'Industrials': {
    roic: 0.09,
    grossMargin: 0.28,
    netMargin: 0.07,
    debtToEquity: 0.55
  },

  // Real Estate - Low ROIC, high leverage
  'Real Estate': {
    roic: 0.04,
    grossMargin: 0.50,
    netMargin: 0.12,
    debtToEquity: 1.80
  },

  // Materials - Commodity-driven
  'Basic Materials': {
    roic: 0.07,
    grossMargin: 0.22,
    netMargin: 0.06,
    debtToEquity: 0.45
  },

  // Communication Services - Mixed
  'Communication Services': {
    roic: 0.08,
    grossMargin: 0.55,
    netMargin: 0.12,
    debtToEquity: 0.80
  },

  // Generic fallback for unknown sectors
  '_default': {
    roic: 0.10,
    grossMargin: 0.40,
    netMargin: 0.08,
    debtToEquity: 0.60
  }
};

/**
 * Gets sector-specific defaults with fallback to generic
 *
 * @param sector - Sector name (case-insensitive)
 * @returns SectorDefaults object with appropriate fallbacks
 *
 * @example
 * const defaults = getSectorDefaults('Technology');
 * const roicBenchmark = benchmarks.roic?.p50 ?? defaults.roic;
 */
export function getSectorDefaults(sector: string | null | undefined): SectorDefaults {
  if (!sector) return SECTOR_DEFAULTS['_default'];

  // Normalize sector name
  const normalized = sector.trim();

  // Direct match
  if (SECTOR_DEFAULTS[normalized]) {
    return SECTOR_DEFAULTS[normalized];
  }

  // Case-insensitive match
  const lowerSector = normalized.toLowerCase();
  for (const [key, value] of Object.entries(SECTOR_DEFAULTS)) {
    if (key.toLowerCase() === lowerSector) {
      return value;
    }
  }

  // Partial match (e.g., "Technology Services" matches "Technology")
  for (const [key, value] of Object.entries(SECTOR_DEFAULTS)) {
    if (lowerSector.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerSector)) {
      return value;
    }
  }

  // Fallback to default
  console.warn(`⚠️  Unknown sector "${sector}", using default values`);
  return SECTOR_DEFAULTS['_default'];
}

/**
 * Validates if a metric value is reasonable for its sector
 * Useful for detecting data anomalies
 */
export function isReasonableForSector(
  metric: 'roic' | 'grossMargin' | 'netMargin' | 'debtToEquity',
  value: number,
  sector: string | null | undefined
): boolean {
  const defaults = getSectorDefaults(sector);
  const expected = defaults[metric];

  // Allow 10x deviation from expected (catches extreme outliers)
  const minBound = expected * 0.1;
  const maxBound = expected * 10;

  return value >= minBound && value <= maxBound;
}
