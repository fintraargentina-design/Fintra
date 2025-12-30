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
  returnOnCapitalEmployedTTM?: number;
  currentRatioTTM?: number;
};

/** ───────────── Perfil (api/v3/profile) ───────────── */
export type FMPCompanyProfile = {
  symbol: string;
  price: number;
  beta: number;
  volAvg: number;
  mktCap: number;
  lastDiv: number;
  range: string;
  changes: number;
  companyName: string;
  currency: string;
  cik: string;
  isin: string;
  cusip: string;
  exchange: string;
  exchangeShortName: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dcfDiff: number;
  dcf: number;
  image: string;
  ipoDate: string;
  defaultImage: boolean;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isAdr: boolean;
  isFund: boolean;
  
  // Optional/Legacy fields compatibility
  changePercentage?: number;
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
  adjClose?: number;
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
  revenuePerShare?: number;
  revenuePerShareTTM?: number;
  freeCashFlowPerShare?: number;
  freeCashFlowPerShareTTM?: number;
  roicTTM?: number;
  freeCashFlowYieldTTM?: number;
  marketCapTTM?: number;
};

export type FMPCashFlowStatement = {
  date: string;
  symbol: string;
  period: string;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  netIncome: number;
};

/** ───────────── Tipos de Respuesta (Arrays) ───────────── */
export type ProfileResponse = FMPCompanyProfile[];
export type RatiosResponse = FMPFinancialRatio[];
export type GrowthResponse = FMPIncomeStatementGrowth[];
export type KeyMetricsResponse = FMPKeyMetrics[];
export type CashFlowResponse = any[]; // TODO: definir tipo completo
export type PeersResponse = string[]; // /v4/stock_peers?symbol=AAPL -> ["AAPL", "MSFT", ...]
export type DetailedPeersResponse = any[]; // TODO: definir si se usa peers detailed
export type PerformanceResponse = any; // Changed from any[] to allow property access
export type DividendsResponse = any; // Changed from any[] to allow property access
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
export type SearchResult = {
  symbol: string;
  name: string;
  currency?: string;
  stockExchange?: string;
  exchangeShortName?: string;
};

export type SearchResponse = SearchResult[];

export type MarketHoursResponse = Record<string, MarketHours>;

export type StockData = {
  symbol: string;
  price: number;
  beta: number;
  volAvg: number;
  mktCap: number;
  lastDiv: number;
  range: string;
  changes: number;
  companyName: string;
  currency: string;
  cik: string;
  isin: string;
  cusip: string;
  exchange: string;
  exchangeShortName: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dcfDiff: number;
  dcf: number;
  image: string;
  ipoDate: string;
  defaultImage: boolean;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isAdr: boolean;
  isFund: boolean;
};

export type StockAnalysis = {
  // Add specific fields if known, otherwise keep it flexible or partial
  fgos_breakdown?: any;
  [key: string]: any; 
};

export type StockPerformance = {
    // Add specific fields if known
    [key: string]: any;
};

export type StockReport = {
    // Add specific fields if known
    [key: string]: any;
};

export type StockEcosystem = {
    // Add specific fields if known
    [key: string]: any;
};

