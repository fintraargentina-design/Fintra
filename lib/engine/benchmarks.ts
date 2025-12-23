export interface SectorBenchmarks {
  peRatio: number;
  roic: number;
  grossMargin: number;
  netMargin: number;
  revenueGrowth: number;
  debtToEquity: number;
}

// Default fallback benchmarks
export const DEFAULT_BENCHMARKS: SectorBenchmarks = {
  peRatio: 20,
  roic: 0.10, // 10%
  grossMargin: 0.30, // 30%
  netMargin: 0.10, // 10%
  revenueGrowth: 0.05, // 5%
  debtToEquity: 1.5,
};

export const SECTOR_BENCHMARKS: Record<string, SectorBenchmarks> = {
  'Technology': {
    peRatio: 25,
    roic: 0.15,
    grossMargin: 0.40,
    netMargin: 0.15,
    revenueGrowth: 0.10,
    debtToEquity: 0.8,
  },
  'Healthcare': {
    peRatio: 22,
    roic: 0.12,
    grossMargin: 0.50,
    netMargin: 0.12,
    revenueGrowth: 0.07,
    debtToEquity: 1.0,
  },
  'Financial Services': {
    peRatio: 12,
    roic: 0.08,
    grossMargin: 0.90, // Not typically used for financials, but kept for structure
    netMargin: 0.20,
    revenueGrowth: 0.04,
    debtToEquity: 3.0, // Banks carry more debt/deposits
  },
  'Energy': {
    peRatio: 10,
    roic: 0.09,
    grossMargin: 0.25,
    netMargin: 0.08,
    revenueGrowth: 0.03,
    debtToEquity: 1.2,
  },
  'Consumer Cyclical': {
    peRatio: 18,
    roic: 0.11,
    grossMargin: 0.35,
    netMargin: 0.09,
    revenueGrowth: 0.06,
    debtToEquity: 1.5,
  },
  'Industrials': {
    peRatio: 18,
    roic: 0.10,
    grossMargin: 0.28,
    netMargin: 0.08,
    revenueGrowth: 0.05,
    debtToEquity: 1.5,
  },
  // Add more sectors as needed
};

export function getBenchmarks(sector: string | undefined): SectorBenchmarks {
  if (!sector) return DEFAULT_BENCHMARKS;
  return SECTOR_BENCHMARKS[sector] || DEFAULT_BENCHMARKS;
}
