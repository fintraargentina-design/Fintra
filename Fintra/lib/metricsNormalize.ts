// lib/metricsNormalize.ts
export type RawMetrics = {
  roePct?: number;               // %
  roicPct?: number;              // %
  grossMarginPct?: number;       // %
  netMarginPct?: number;         // %
  debtToCapital?: number;        // ratio
  currentRatio?: number;         // ratio
  interestCoverage?: number;     // veces
  freeCashFlowMarginPct?: number;// % (si tienes FCF absoluto, mejor convertir a % ventas)
  cagrRevenue5y?: number;        // %
  cagrEps5y?: number;            // %
  cagrEquity5y?: number;         // %
  bookValuePerShare?: number;    // $
  sharesOutstanding?: number;    // unidades
};

const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));

// Escala lineal con tope (para porcentajes donde "más alto = mejor")
const pctCap = (x?: number, cap = 40) =>
  x == null ? null : clamp((Math.max(x, 0) / cap) * 100);

// Inversa para ratios donde "más bajo = mejor" (deuda/capital)
const inverseRatio = (x?: number, bueno = 0.5, maxMalo = 3) => {
  if (x == null) return null;
  const v = Math.min(x, maxMalo);
  const score = ((maxMalo - v) / (maxMalo - bueno)) * 100;
  return clamp(score);
};

// Sweet spot (ideal alrededor de un valor; penaliza a ambos lados)
const sweetSpot = (x?: number, ideal = 2, rango = 1.5 /* ±1.5 */) => {
  if (x == null) return null;
  const dist = Math.abs(x - ideal);
  const score = (1 - Math.min(dist / rango, 1)) * 100;
  return clamp(score);
};

// Log-saturado (para coberturas enormes)
const logSaturate = (x?: number, cap = 20) => {
  if (x == null) return null;
  const v = Math.min(Math.max(x, 0), cap);
  return clamp((Math.log(1 + v) / Math.log(1 + cap)) * 100);
};

// “Más bajo = mejor” para shares (si decides usarlo): capea a sector/umbral
const inverseLinear = (x?: number, maxMalo = 20e9, bueno = 1e9) => {
  if (x == null) return null;
  const v = Math.min(x, maxMalo);
  const score = ((maxMalo - v) / (maxMalo - bueno)) * 100;
  return clamp(score);
};

// “Más alto = mejor” (book value ps). Úsalo con cautela.
const linearCap = (x?: number, cap = 50) => (x == null ? null : clamp((x / cap) * 100));

export type ScoredMetric = { label: string; value: number | null; };

export function normalizeMetrics(raw: RawMetrics): ScoredMetric[] {
  const rows: ScoredMetric[] = [
    { label: "ROE",                 value: pctCap(raw.roePct, 40) },
    { label: "ROIC",                value: pctCap(raw.roicPct, 40) },
    { label: "Margen bruto",        value: pctCap(raw.grossMarginPct, 80) },
    { label: "Margen neto",         value: pctCap(raw.netMarginPct, 30) },
    { label: "Deuda/Capital",       value: inverseRatio(raw.debtToCapital, 0.5, 3) },
    { label: "Current Ratio",       value: sweetSpot(raw.currentRatio, 2, 1.5) },
    { label: "Cobertura intereses", value: logSaturate(raw.interestCoverage, 20) },
    { label: "Flujo de Caja Libre (%)", value: pctCap(raw.freeCashFlowMarginPct, 30) },
    { label: "CAGR ingresos",       value: pctCap(raw.cagrRevenue5y, 30) },
    { label: "CAGR beneficios",     value: pctCap(raw.cagrEps5y, 40) },
    { label: "CAGR patrimonio",     value: pctCap(raw.cagrEquity5y, 25) },
    { label: "Book Value/acc",      value: linearCap(raw.bookValuePerShare, 60) },
    { label: "Acciones en circulación", value: inverseLinear(raw.sharesOutstanding, 40e9, 2e9) },
  ];
  return rows;
}
