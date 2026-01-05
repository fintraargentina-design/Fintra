// lib/engine/benchmarks.ts

export const SECTOR_BENCHMARKS: Record<string, any> = {
  Technology: {
    pe_ratio: 25,
    ev_ebitda: 18,
    p_fcf: 25,
    net_margin: 0.15,
    roe: 0.20,
    debt_to_equity: 0.5,
    revenue_growth: 0.12
  },
  "Communication Services": {
    pe_ratio: 20,
    ev_ebitda: 14,
    p_fcf: 20,
    net_margin: 0.12,
    roe: 0.15,
    debt_to_equity: 0.7,
    revenue_growth: 0.09
  },
  Healthcare: {
    pe_ratio: 22,
    ev_ebitda: 16,
    p_fcf: 22,
    net_margin: 0.10,
    roe: 0.15,
    debt_to_equity: 0.6,
    revenue_growth: 0.08
  },
  "Financial Services": {
    pe_ratio: 13,
    ev_ebitda: 10,
    p_fcf: 12,
    net_margin: 0.18,
    roe: 0.11,
    debt_to_equity: 2.0,
    revenue_growth: 0.05
  },
  "Consumer Cyclical": {
    pe_ratio: 22,
    ev_ebitda: 15,
    p_fcf: 20,
    net_margin: 0.06,
    roe: 0.15,
    debt_to_equity: 0.8,
    revenue_growth: 0.08
  },
  "Consumer Defensive": {
    pe_ratio: 20,
    ev_ebitda: 14,
    p_fcf: 18,
    net_margin: 0.05,
    roe: 0.18,
    debt_to_equity: 1.2,
    revenue_growth: 0.04
  },
  Industrials: {
    pe_ratio: 18,
    ev_ebitda: 12,
    p_fcf: 18,
    net_margin: 0.07,
    roe: 0.14,
    debt_to_equity: 0.9,
    revenue_growth: 0.05
  },
  Energy: {
    pe_ratio: 10,
    ev_ebitda: 6,
    p_fcf: 8,
    net_margin: 0.08,
    roe: 0.10,
    debt_to_equity: 0.8,
    revenue_growth: 0.04
  },
  "Basic Materials": {
    pe_ratio: 15,
    ev_ebitda: 9,
    p_fcf: 12,
    net_margin: 0.06,
    roe: 0.10,
    debt_to_equity: 0.6,
    revenue_growth: 0.04
  },
  "Real Estate": {
    pe_ratio: 35, 
    ev_ebitda: 20,
    p_fcf: 20,
    net_margin: 0.15,
    roe: 0.05,
    debt_to_equity: 2.5,
    revenue_growth: 0.05
  },
  Utilities: {
    pe_ratio: 18,
    ev_ebitda: 11,
    p_fcf: 15,
    net_margin: 0.10,
    roe: 0.09,
    debt_to_equity: 1.5,
    revenue_growth: 0.03
  },
  General: {
    pe_ratio: 18,
    ev_ebitda: 12,
    p_fcf: 15,
    net_margin: 0.10,
    roe: 0.15,
    debt_to_equity: 1.0,
    revenue_growth: 0.07
  }
};

export const getBenchmarksForSector = (sector: string | undefined) => {
  if (!sector) return SECTOR_BENCHMARKS.General;
  
  const cleanSector = sector.trim();

  // 1. Búsqueda Exacta
  if (SECTOR_BENCHMARKS[cleanSector]) return SECTOR_BENCHMARKS[cleanSector];

  // 2. Búsqueda Aproximada (Case Insensitive y sin espacios)
  const key = Object.keys(SECTOR_BENCHMARKS).find(k => 
    cleanSector.toLowerCase().replace(/ /g,'').includes(k.toLowerCase().replace(/ /g,'')) || 
    k.toLowerCase().replace(/ /g,'').includes(cleanSector.toLowerCase().replace(/ /g,''))
  );

  return key ? SECTOR_BENCHMARKS[key] : SECTOR_BENCHMARKS.General;
};