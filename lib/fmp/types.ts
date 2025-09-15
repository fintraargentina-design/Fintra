// /lib/fmp/types.ts

/** Clave común para retornos por período (usada en /performance y en la UI) */
export type ReturnsKey = '1M' | '3M' | 'YTD' | '1Y' | '3Y' | '5Y';

/** ───────────── Ratios (api/v3/ratios) ───────────── */
export type FMPFinancialRatio = {
  symbol: string;
  date: string;
  period: string;

  // Liquidez
  currentRatio?: number;
  quickRatio?: number;
  cashRatio?: number;

  // Márgenes (en FMP vienen como fracciones: 0.20 = 20%)
  grossProfitMargin?: number;
  operatingProfitMargin?: number;
  netProfitMargin?: number;

  // Rentabilidad
  returnOnAssets?: number;
  returnOnEquity?: number;             // ROE
  returnOnCapitalEmployed?: number;    // ROIC aprox.

  // Solvencia
  interestCoverage?: number;           // veces
  debtEquityRatio?: number;            // deuda/capital

  // Valoración
  dividendYield?: number;              // fracción (0.012 = 1.2%)
  priceEarningsRatio?: number;         // P/E
  enterpriseValueMultiple?: number;    // EV/EBITDA
  priceToBookRatio?: number;           // P/B
  priceToSalesRatio?: number;          // P/S
  priceToFreeCashFlowsRatio?: number;  // P/FCF (a veces)
  priceToFreeCashFlowRatio?: number;   // alias alternativo

  // Otros
  freeCashFlowOperatingCashFlowRatio?: number;
};

/** ───────────── Perfil (api/v3/profile) ───────────── */
export type FMPCompanyProfile = {
  symbol: string;
  companyName: string;
  price?: number;
  mktCap?: number;
  beta?: number;
  sector?: string;
  industry?: string;
  exchange?: string;
  currency?: string;
  changes?: number | string;
  changePercentage?: number;
  image?: string;
};

/** ───────────── Crecimiento (api/v3/financial-growth) ─────────────
 *  FMP devuelve tasas como fracciones (0.10 = 10%)
 */
export type FMPIncomeStatementGrowth = {
  date: string;
  symbol: string;
  period: string;
  revenueGrowth?: number;              // ✅ Nombre real de FMP
  epsgrowth?: number;                  // ✅ Nombre real de FMP  
  growthNetIncome?: number;
  growthOperatingIncome?: number;
  stockholdersEquityGrowth?: number;   // ✅ Nombre real de FMP
};

/** ───────────── Balance Sheet Growth (api/v3/balance-sheet-statement-growth) ───────────── */
export type FMPBalanceSheetGrowth = {
  symbol: string;
  date: string;
  fiscalYear: string;
  period: string;
  reportedCurrency: string;
  growthTotalStockholdersEquity?: number;  // Este es el que necesitamos
  growthTotalAssets?: number;
  growthTotalLiabilities?: number;
  growthRetainedEarnings?: number;
  growthCommonStock?: number;
  // ... otros campos de crecimiento del balance
};

export type BalanceSheetGrowthResponse = FMPBalanceSheetGrowth[];
/** ───────────── Key Metrics (api/v3/key-metrics-ttm / key-metrics) ───────────── */
export type FMPKeyMetrics = {
  symbol: string;
  date: string;
  period: string;
  bookValuePerShare?: number;
  sharesOutstanding?: number;
  freeCashFlowPerShare?: number;
};

/** ───────────── Cash Flow (api/v3/cash-flow) ───────────── */
export type FMPCashFlowStatement = {
  symbol: string;
  date: string;
  period: string;
  netCashProvidedByOperatingActivities?: number; // operatingCashFlow
  capitalExpenditure?: number;                   // capex (suele ser negativo)
  freeCashFlow?: number;                         // algunos endpoints lo incluyen
};

/** ───────────── Peers (v3/v4/stable) ───────────── */
export type PeersResponse = {
  symbol: string;
  peers: string[];
  source: 'fmp';
  updatedAt: string;
};

export type DetailedPeer = {
  symbol: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  price?: number;
  mktCap?: number;
  beta?: number;
  currency?: string;
  image?: string;
};

export type DetailedPeersResponse = {
  symbol: string;
  peers: DetailedPeer[];
  source: 'fmp';
  updatedAt: string;
};

/** ───────────── Financial Scores (stable/financial-scores) ───────────── */
export type FMPFinancialScore = {
  symbol: string;
  reportedCurrency?: string;
  altmanZScore: number | null;
  piotroskiScore: number | null;
  workingCapital?: number;
  totalAssets?: number;
  retainedEarnings?: number;
  ebit?: number;
  marketCap?: number;
  totalLiabilities?: number;
  revenue?: number;
};

/** ───────────── Performance (route interna /api/fmp/performance) ───────────── */
export type PerformanceResponse = {
  symbol: string;
  returns: Record<ReturnsKey, number | null>;
  vol1Y: number | null;    // %
  maxDD1Y: number | null;  // % (negativo)
  updatedAt: string;
  source: 'fmp';
  error?: string;
};

/** ───────────── Dividendos (route interna /api/fmp/dividends) ───────────── */
export type DividendsResponse = {
  symbol: string;
  dpsByYear: Array<{ year: number; dps: number }>;
  yieldByYear: Array<{ year: number; yield: number | null }>;
  yieldTTM: number | null;
  exDates: string[];     // ISO (ex-date)
  payDates: string[];    // ISO (payment date)
  payout: { eps: number | null; fcf: number | null };
  updatedAt: string;
  source: 'fmp';
  error?: string;
};

/** ───────────── Candles normalizados (route interna /api/fmp/eod) ───────────── */
export type OHLC = {
  date: string;  // normalizado YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type EodResponse = {
  symbol: string;
  candles: OHLC[];
};

/** ───────────── Valuation (route interna /api/fmp/valuation) ───────────── */
export type ValuationResponse = {
  symbol: string;
  date: string | null;

  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  pb: number | null;
  ps: number | null;
  pfcf: number | null;
  evEbitda: number | null;
  evSales: number | null;
  dividendYield: number | null; // en %

  // reservados para mejoras (percentiles, z-score vs peers, etc.)
  pePercentile5y: number | null;
  peZscorePeers: number | null;
  impliedGrowth: number | null;
  discountVsPt: number | null;

  rawRatios?: any;
  rawGrowth?: any[];

  updatedAt: string;
  source: 'fmp';
  error?: string;
};

/** ───────────── Helpers de respuestas ───────────── */
export type RatiosResponse = FMPFinancialRatio[];
export type GrowthResponse = FMPIncomeStatementGrowth[];
export type ProfileResponse = FMPCompanyProfile[];
export type KeyMetricsResponse = FMPKeyMetrics[];
export type CashFlowResponse = FMPCashFlowStatement[];
export type PeersResponseArray = PeersResponse[];
export type DetailedPeersResponseArray = DetailedPeersResponse[];
export type PerformanceResponseArray = PerformanceResponse[];
// Cambiar esta línea:
export type FinancialScoreResponse = {
  symbol: string;
  date?: string;
  altmanZ: number | null;
  piotroski: number | null;
  raw?: FMPFinancialScore; // Los datos originales están en raw
};
export type FinancialScoreResponse = FMPFinancialScore[];
