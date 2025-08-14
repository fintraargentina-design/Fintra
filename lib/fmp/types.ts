// /lib/fmp/types.ts
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
  dividendYield?: number;
  priceEarningsRatio?: number;
  enterpriseValueMultiple?: number;
  priceToBookRatio?: number;
  freeCashFlowOperatingCashFlowRatio?: number;
  debtEquityRatio?: number;
};

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
  changes?: number;
  image?: string;
};

export type FMPIncomeStatementGrowth = {
  date: string;
  symbol: string;
  period: string;
  growthRevenue: number;
  growthEPS: number;
};

export type PeerSymbol = string;

export type PeersResponse = {
  symbol: string;
  peers: PeerSymbol[];
};

export type DetailedPeer = Pick<FMPCompanyProfile,
  "symbol" | "companyName" | "price" | "mktCap" | "beta" | "sector" | "industry" | "currency" | "image"
>;

export type DetailedPeersResponse = {
  symbol: string;
  peers: DetailedPeer[];
};
