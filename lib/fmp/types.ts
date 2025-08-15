// /lib/fmp/types.ts

/** ───────────── Ratios (api/v3/ratios) ───────────── */
export type FMPFinancialRatio = {
  symbol: string;
  date: string;
  period: string;

  // Liquidez
  currentRatio?: number;
  quickRatio?: number;
  cashRatio?: number;

  // Márgenes (en FMP vienen como decimales: 0.20 = 20%)
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

  // Valoración (por si las usas)
  dividendYield?: number;
  priceEarningsRatio?: number;
  enterpriseValueMultiple?: number;    // EV/EBITDA
  priceToBookRatio?: number;

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
  image?: string;
};

/** ───────────── Crecimiento (api/v3/income-statement-growth) ─────────────
 *  Ojo: FMP devuelve tasas como decimales (0.10 = 10%)
 */
export type FMPIncomeStatementGrowth = {
  date: string;
  symbol: string;
  period: string;

  growthRevenue?: number;              // 0.10 = 10%
  growthEPS?: number;                  // 0.12 = 12%
  // Campos que la tarjeta ya intenta usar:
  growthNetIncome?: number;
  growthOperatingIncome?: number;
  growthStockholdersEquity?: number;
};

/** ───────────── Key Metrics (api/v3/key-metrics) ─────────────
 *  Útiles para Book Value por acción y Shares Outstanding
 *  (si luego creas la route /api/fmp/key-metrics)
 */
export type FMPKeyMetrics = {
  symbol: string;
  date: string;
  period: string;
  bookValuePerShare?: number;
  sharesOutstanding?: number;
  freeCashFlowPerShare?: number;
};

/** ───────────── Cash Flow (api/v3/cash-flow-statement) ─────────────
 *  Útil para calcular FCF: OCF - CapEx (o usar freeCashFlow si viene).
 */
export type FMPCashFlowStatement = {
  symbol: string;
  date: string;
  period: string;
  netCashProvidedByOperatingActivities?: number; // operatingCashFlow
  capitalExpenditure?: number;                   // capex (negativo)
  freeCashFlow?: number;                         // algunos endpoints lo incluyen
};

/** ───────────── Peers ───────────── */
export type PeerSymbol = string;

export type PeersResponse = {
  symbol: string;
  peers: PeerSymbol[];
};

export type DetailedPeer = Pick<
  FMPCompanyProfile,
  | "symbol"
  | "companyName"
  | "price"
  | "mktCap"
  | "beta"
  | "sector"
  | "industry"
  | "currency"
  | "image"
>;

export type DetailedPeersResponse = {
  symbol: string;
  peers: DetailedPeer[];
};

/** ───────────── Helpers de respuestas ───────────── */
export type RatiosResponse = FMPFinancialRatio[];
export type GrowthResponse = FMPIncomeStatementGrowth[];
export type ProfileResponse = FMPCompanyProfile[];
export type KeyMetricsResponse = FMPKeyMetrics[];
export type CashFlowResponse = FMPCashFlowStatement[];
