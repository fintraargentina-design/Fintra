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
  priceEarningsToGrowthRatio?: number; // PEG Ratio

  // Otros
  freeCashFlowOperatingCashFlowRatio?: number;

  // TTM variants (commonly returned by /ratios-ttm)
  returnOnEquityTTM?: number;
  netProfitMarginTTM?: number;
  assetTurnoverTTM?: number;
  debtEquityRatioTTM?: number;
  interestCoverageTTM?: number;
  grossProfitMarginTTM?: number;
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
  netIncomeGrowth?: number;
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

export type OHLC = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type FMPKeyMetrics = {
  symbol: string;
  date: string;
  period: string;
  bookValuePerShare?: number;
  // Alias TTM si FMP lo devuelve con sufijo
  bookValuePerShareTTM?: number;
  sharesOutstanding?: number;
  freeCashFlowPerShare?: number;
  roicTTM?: number;
  freeCashFlowYieldTTM?: number;
};

/** ───────────── Tipos de Respuesta (Arrays) ───────────── */
export type ProfileResponse = FMPCompanyProfile[];
export type RatiosResponse = FMPFinancialRatio[];
export type GrowthResponse = FMPIncomeStatementGrowth[];
export type KeyMetricsResponse = FMPKeyMetrics[];
export type CashFlowResponse = any[]; // TODO: definir tipo completo
export type PeersResponse = string[]; // /v4/stock_peers?symbol=AAPL -> ["AAPL", "MSFT", ...]
export type DetailedPeersResponse = any[]; // TODO: definir si se usa peers detailed
export type PerformanceResponse = any[]; // TODO: definir
export type DividendsResponse = any[]; // TODO: definir
export type EodResponse = any[]; // TODO: definir
export type FinancialScoreResponse = any[]; // TODO: definir

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
  dividendYield: number | null; // %
  pePercentile5y: number | null;
  peZscorePeers: number | null;
  impliedGrowth: number | null;
  discountVsPt: number | null;
  rawRatios?: any;
  rawGrowth?: any[];
  updatedAt: string;
  source: "fmp";
  error?: string;
};

export type InstitutionalHolder = {
  holder: string;
  shares: number;
  dateReported: string;
  change: number;
  weight: number;
};

export type InsiderTrading = {
  symbol: string;
  filingDate: string;
  transactionDate: string;
  reportingCik: string;
  transactionType: string;
  securitiesOwned: number;
  companyCik: string;
  reportingName: string;
  typeOfOwner: string;
  acquistionOrDisposition: string;
  formType: string;
  securitiesTransacted: number;
  price: number;
  securityName: string;
  link: string;
};

export type InstitutionalHoldersResponse = InstitutionalHolder[];
export type InsiderTradingResponse = InsiderTrading[];

export type MarketHours = {
  openingHour: string;
  closingHour: string;
  isTheStockMarketOpen: boolean;
};
export type MarketHoursResponse = Record<string, MarketHours>;
