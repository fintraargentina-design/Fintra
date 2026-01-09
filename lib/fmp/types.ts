// /lib/fmp/types.ts

/** Clave común para retornos por período (usada en /performance y en la UI) */
export type ReturnsKey = '1M' | '3M' | 'YTD' | '1Y' | '3Y' | '5Y';

/** ───────────── Ratios (api/v3/ratios) ───────────── */
export type FMPFinancialRatio = {
  symbol: string;
  date: string;
  period: string;
  currentRatio?: number;
  quickRatio?: number;
  cashRatio?: number;
  grossProfitMargin?: number;
  operatingProfitMargin?: number;
  netProfitMargin?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  returnOnCapitalEmployed?: number;
  interestCoverage?: number;
  debtEquityRatio?: number;
  dividendYield?: number;
  priceEarningsRatio?: number;
  enterpriseValueMultiple?: number;
  priceToBookRatio?: number;
  priceToSalesRatio?: number;
  priceToFreeCashFlowsRatio?: number;
  priceToFreeCashFlowRatio?: number;
  priceEarningsToGrowthRatio?: number;
  freeCashFlowOperatingCashFlowRatio?: number;
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
  changePercentage?: number;
};

/** ───────────── Crecimiento (api/v3/financial-growth) ───────────── */
export type FMPGrowth = {
  symbol: string;
  date: string;
  period: string;
  revenueGrowth?: number;
  grossProfitGrowth?: number;
  ebitgrowth?: number;
  operatingIncomeGrowth?: number;
  netIncomeGrowth?: number;
  epsgrowth?: number;
  epsdilutedGrowth?: number;
  weightedAverageSharesGrowth?: number;
  weightedAverageSharesDilutedGrowth?: number;
  dividendsperShareGrowth?: number;
  operatingCashFlowGrowth?: number;
  freeCashFlowGrowth?: number;
  tenYRevenueGrowthPerShare?: number;
  fiveYRevenueGrowthPerShare?: number;
  threeYRevenueGrowthPerShare?: number;
  tenYNetIncomeGrowthPerShare?: number;
  fiveYNetIncomeGrowthPerShare?: number;
  threeYNetIncomeGrowthPerShare?: number;
  tenYShareholdersEquityGrowthPerShare?: number;
  fiveYShareholdersEquityGrowthPerShare?: number;
  threeYShareholdersEquityGrowthPerShare?: number;
  tenYDividendperShareGrowthPerShare?: number;
  fiveYDividendperShareGrowthPerShare?: number;
  threeYDividendperShareGrowthPerShare?: number;
  receivablesGrowth?: number;
  inventoryGrowth?: number;
  assetGrowth?: number;
  bookValueperShareGrowth?: number;
  debtGrowth?: number;
  rdexpenseGrowth?: number;
  sgaexpensesGrowth?: number;
};

export type PeersResponse = {
  symbol: string;
  peers: string[];
  source?: string;
  updatedAt?: string;
  details?: any[];
};

export type DetailedPeersResponse = {
  symbol: string;
  peers: any[];
};

export type RatiosResponse = FMPFinancialRatio[];
export type GrowthResponse = FMPGrowth[];
export type ProfileResponse = FMPCompanyProfile[];
export type PerformanceResponse = any;
export type DividendsResponse = any;
export type EodResponse = any;
export type ValuationResponse = any;
export type FinancialScoreResponse = any;
export type KeyMetricsResponse = any;
export type CashFlowResponse = any;
export type ScreenerResponse = any[];
export type BalanceSheetGrowthResponse = any;
export type InstitutionalHoldersResponse = any;
export type InsiderTradingResponse = any;
export type MarketHoursResponse = any;
export type AllMarketHoursResponse = any;

export type FMPEod = any;
export type OHLC = FMPEod;

/** ───────────── Search (stable/search-symbol) ───────────── */
export type FMPSearchResult = {
  symbol: string;
  name: string;
  currency: string;
  stockExchange: string;
  exchangeShortName: string;
};

export type SearchResponse = FMPSearchResult[];

export type StockAnalysis = {
  fgos_breakdown?: any;
  [key: string]: any; 
};

export type StockPerformance = {
    [key: string]: any;
};

export type StockReport = {
    [key: string]: any;
};

export type StockEcosystem = {
    [key: string]: any;
};
