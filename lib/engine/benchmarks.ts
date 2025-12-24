// Benchmarks por sector para normalizar puntajes
// Estos son valores aproximados "ideales" o "promedio" para comparar

export const SECTOR_BENCHMARKS: Record<string, any> = {
  Technology: {
    pe_ratio: 25,
    net_margin: 0.15,
    roe: 0.20,
    debt_to_equity: 0.5,
    revenue_growth: 0.10
  },
  Healthcare: {
    pe_ratio: 22,
    net_margin: 0.10,
    roe: 0.15,
    debt_to_equity: 0.6,
    revenue_growth: 0.08
  },
  Financial: {
    pe_ratio: 12,
    net_margin: 0.20,
    roe: 0.12,
    debt_to_equity: 1.5, // Bancos suelen tener más apalancamiento
    revenue_growth: 0.05
  },
  Energy: {
    pe_ratio: 10,
    net_margin: 0.08,
    roe: 0.10,
    debt_to_equity: 0.8,
    revenue_growth: 0.03
  },
  ConsumerCyclical: {
    pe_ratio: 18,
    net_margin: 0.06,
    roe: 0.15,
    debt_to_equity: 0.7,
    revenue_growth: 0.06
  },
  // Default fallback
  General: {
    pe_ratio: 18,
    net_margin: 0.10,
    roe: 0.15,
    debt_to_equity: 1.0,
    revenue_growth: 0.07
  }
};

export const getBenchmarksForSector = (sector: string | undefined) => {
  if (!sector) return SECTOR_BENCHMARKS.General;
  
  // Intento simple de matching, podría mejorarse con string similarity
  const key = Object.keys(SECTOR_BENCHMARKS).find(k => 
    sector.toLowerCase().includes(k.toLowerCase())
  );
  
  return key ? SECTOR_BENCHMARKS[key] : SECTOR_BENCHMARKS.General;
};
