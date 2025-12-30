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
export type FMPGrowth = {
  symbol: string;
  date: string;
  period: string;

  // Revenue
  revenueGrowth?: number;
  grossProfitGrowth?: number;
  ebitgrowth?: number;
  operatingIncomeGrowth?: number;
  netIncomeGrowth?: number;
  epsgrowth?: number;
  epsdilutedGrowth?: number;

  // Cash Flow
  operatingCashFlowGrowth?: number;
  freeCashFlowGrowth?: number;
  dividendsperShareGrowth?: number;

  // Balance Sheet
  assetGrowth?: number;
  debtGrowth?: number;
  bookValueperShareGrowth?: number;
  
  // Ratios
  grossProfitMarginGrowth?: number; // ?
  netProfitMarginGrowth?: number;   // ?
  
  // 3Y / 5Y / 10Y
  threeYRevenueGrowthPerShare?: number;
  fiveYRevenueGrowthPerShare?: number;
  threeYNetIncomeGrowthPerShare?: number;
  fiveYNetIncomeGrowthPerShare?: number;
  tenYRevenueGrowthPerShare?: number;
  tenYNetIncomeGrowthPerShare?: number;
  tenYShareholdersEquityGrowthPerShare?: number;
  
  // Otros
  rdexpenseGrowth?: number;
  sgaexpensesGrowth?: number;
};

/** ───────────── Balance Sheet Growth (api/v3/balance-sheet-statement-growth) ───────────── */
export type BalanceSheetGrowth = {
  symbol: string;
  date: string;
  period: string;
  growthReceivables?: number;
  growthInventory?: number;
  growthAccountsPayable?: number;
  growthOtherAssets?: number;
  growthOtherLiabilities?: number;
  growthTotalAssets?: number;
  growthTotalLiabilities?: number;
  growthTotalEquity?: number;
  growthShortTermDebt?: number;
  growthNetDebt?: number;
};

/** ───────────── EOD (Historical Price Full) ───────────── */
export type EodCandle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  unadjustedVolume: number;
  change: number;
  changePercent: number;
  vwap: number;
  label: string;
  changeOverTime: number;
};

/** ───────────── Peers ───────────── */
export type PeersResponse = string[]; 

export interface DetailedPeersResponse {
  symbol: string;
  peersList: string[];
}

/** ───────────── Performance ───────────── */
export interface PerformanceResponse {
  [key: string]: number; // dynamic keys or typed? Usually object with return1M, return1Y...
}

/** ───────────── Dividends ───────────── */
export interface DividendItem {
  date: string;
  label: string;
  adjDividend: number;
  dividend: number;
  recordDate: string;
  paymentDate: string;
  declarationDate: string;
}
export interface DividendsResponse {
  symbol: string;
  historical: DividendItem[];
}

/** ───────────── Valuation ───────────── */
export interface ValuationItem {
  symbol: string;
  date: string;
  peRatio?: number;
  pegRatio?: number;
  priceToSalesRatio?: number;
  priceToBookRatio?: number;
  priceToFreeCashFlowRatio?: number;
  enterpriseValueMultiple?: number; // EV/EBITDA
}

/** ───────────── Financial Scores ───────────── */
export interface FinancialScoreItem {
  symbol: string;
  altmanZScore: number;
  piotroskiScore: number;
  workingCapital?: number;
  totalAssets?: number;
  retainedEarnings?: number;
  ebit?: number;
  marketCap?: number;
  totalLiabilities?: number;
  revenue?: number;
  reportedCurrency?: string;
}

/** ───────────── Key Metrics ───────────── */
export interface KeyMetricsItem {
  symbol: string;
  date: string;
  period: string;
  
  revenuePerShare?: number;
  netIncomePerShare?: number;
  operatingCashFlowPerShare?: number;
  freeCashFlowPerShare?: number;
  cashPerShare?: number;
  bookValuePerShare?: number;
  tangibleBookValuePerShare?: number;
  shareholdersEquityPerShare?: number;
  interestDebtPerShare?: number;
  marketCap?: number;
  enterpriseValue?: number;
  peRatio?: number;
  priceToSalesRatio?: number;
  pocfratio?: number;
  pfcfRatio?: number;
  pbRatio?: number;
  ptbRatio?: number;
  evToSales?: number;
  enterpriseValueOverEBITDA?: number;
  evToOperatingCashFlow?: number;
  evToFreeCashFlow?: number;
  earningsYield?: number;
  freeCashFlowYield?: number;
  debtToEquity?: number;
  debtToAssets?: number;
  netDebtToEBITDA?: number;
  currentRatio?: number;
  interestCoverage?: number;
  incomeQuality?: number;
  dividendYield?: number;
  payoutRatio?: number;
  salesGeneralAndAdministrativeToRevenue?: number;
  researchAndDdevelopementToRevenue?: number;
  intangiblesToTotalAssets?: number;
  capexToOperatingCashFlow?: number;
  capexToRevenue?: number;
  capexToDepreciation?: number;
  stockBasedCompensationToRevenue?: number;
  grahamNumber?: number;
  roic?: number;
  returnOnTangibleAssets?: number;
  grahamNetNet?: number;
  workingCapital?: number;
  tangibleAssetValue?: number;
  netCurrentAssetValue?: number;
  investedCapital?: number;
  averageReceivables?: number;
  averagePayables?: number;
  averageInventory?: number;
  daysSalesOutstanding?: number;
  daysPayablesOutstanding?: number;
  daysOfInventoryOnHand?: number;
  receivablesTurnover?: number;
  payablesTurnover?: number;
  inventoryTurnover?: number;
  roe?: number;
  capexPerShare?: number;
}

/** ───────────── Cash Flow ───────────── */
export interface CashFlowItem {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  netIncome: number;
  depreciationAndAmortization: number;
  deferredIncomeTax: number;
  stockBasedCompensation: number;
  changeInWorkingCapital: number;
  accountsReceivables: number;
  inventory: number;
  accountsPayables: number;
  otherWorkingCapital: number;
  otherNonCashItems: number;
  netCashProvidedByOperatingActivities: number;
  investmentsInPropertyPlantAndEquipment: number;
  acquisitionsNet: number;
  purchasesOfInvestments: number;
  salesMaturitiesOfInvestments: number;
  otherInvestingActivites: number;
  netCashUsedForInvestingActivites: number;
  debtRepayment: number;
  commonStockIssued: number;
  commonStockRepurchased: number;
  dividendsPaid: number;
  otherFinancingActivites: number;
  netCashUsedProvidedByFinancingActivities: number;
  effectOfForexChangesOnCash: number;
  netChangeInCash: number;
  cashAtEndOfPeriod: number;
  cashAtBeginningOfPeriod: number;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  link: string;
  finalLink: string;
}

/** ───────────── Institutional Holders ───────────── */
export interface InstitutionalHolderItem {
  holder: string;
  shares: number;
  dateReported: string;
  change: number;
}

/** ───────────── Insider Trading ───────────── */
export interface InsiderTradingItem {
  symbol: string;
  filingDate: string;
  transactionDate: string;
  reportingName: string;
  transactionType: string;
  securitiesOwned: number;
  securitiesTransacted: number;
  price: number;
  link: string;
}

/** ───────────── Market Hours ───────────── */
export interface MarketHoursItem {
  openingHour: string;
  closingHour: string;
  timezone: string;
}

/** ───────────── OHLC ───────────── */
export interface OHLC {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
  unadjustedVolume: number;
  change: number;
  changePercent: number;
  vwap: number;
  label: string;
  changeOverTime: number;
}

/** ───────────── Risk Premium (api/v4/market_risk_premium) ───────────── */
export interface MarketRiskPremium {
  country: string;
  continent: string;
  totalEquityRiskPremium: number;
  countryRiskPremium: number;
  riskFreeRate?: number; // Sometimes inferred
}

// Tipos de respuesta de API
export type RatiosResponse = FMPFinancialRatio[];
export type GrowthResponse = FMPGrowth[];
export type BalanceSheetGrowthResponse = BalanceSheetGrowth[];
export type EodResponse = { symbol: string; historical: EodCandle[] };
export type ProfileResponse = FMPCompanyProfile[];
export type ValuationResponse = ValuationItem[];
export type FinancialScoreResponse = FinancialScoreItem[];
export type KeyMetricsResponse = KeyMetricsItem[];
export type CashFlowResponse = CashFlowItem[];
export type InstitutionalHoldersResponse = InstitutionalHolderItem[];
export type InsiderTradingResponse = InsiderTradingItem[];
export type MarketHoursResponse = MarketHoursItem;
export type MarketRiskPremiumResponse = MarketRiskPremium[];

/** ───────────── Stock Screener (api/v3/stock-screener) ───────────── */
export interface ScreenerItem {
  symbol: string;
  companyName: string;
  marketCap: number;
  sector: string;
  industry: string;
  beta: number;
  price: number;
  lastAnnualDividend: number;
  volume: number;
  exchange: string;
  exchangeShortName: string;
  country: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
}

export type ScreenerResponse = ScreenerItem[];
