// /lib/fmp/factory.ts
import type {
  PeersResponse,
  PerformanceResponse,
  DividendsResponse,
  EodResponse,
  ProfileResponse,
  RatiosResponse,
  GrowthResponse,
  BalanceSheetGrowthResponse,
  DetailedPeersResponse,
  FinancialScoreResponse,
  KeyMetricsResponse,
  CashFlowResponse,
  ValuationResponse,
  InstitutionalHoldersResponse,
  InsiderTradingResponse,
  MarketHoursResponse,
  AllMarketHoursResponse,
} from "@/lib/fmp/types";

export type CacheOpt = RequestCache | undefined;
export type GetOpts = { params?: Record<string, any>; cache?: CacheOpt };

export type FetcherFunction = <T>(path: string, opts?: GetOpts) => Promise<T>;

export function createFmpClient(get: FetcherFunction) {
  return {
    /** Peers simples (nota: el backend puede incluir `details` si pasas detailed=1, pero aquí tipamos lo básico) */
    peers(symbol: string, opts?: { limit?: number; detailed?: boolean; cache?: CacheOpt }) {
      return get<PeersResponse>("/peers", {
        params: {
          symbol,
          ...(opts?.limit ? { limit: opts.limit } : {}),
          ...(opts?.detailed ? { detailed: 1 } : {}),
        },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Peers detallados (estructura tipada) */
    peersDetailed(symbol: string, opts?: { limit?: number; cache?: CacheOpt }) {
      return get<DetailedPeersResponse>("/peers/detailed", {
        params: { symbol, ...(opts?.limit ? { limit: opts.limit } : {}) },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Ratios con soporte de periodo (annual|quarter) */
    ratios(symbol: string, opts?: { limit?: number; period?: "annual" | "quarter"; cache?: CacheOpt }) {
      return get<RatiosResponse>("/ratios", {
        params: {
          symbol,
          limit: opts?.limit ?? 1,
          period: opts?.period ?? "annual",
        },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Ratios TTM (trailing twelve months) */
    ratiosTTM(symbol: string, opts?: { cache?: CacheOpt }) {
      return get<RatiosResponse>("/ratios-ttm", {
        params: { symbol },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Perfil (array como lo da FMP /v3/profile) */
    profile(symbol: string, opts?: { cache?: CacheOpt }) {
      return get<ProfileResponse>("/profile", {
        params: { symbol },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Financial growth (annual/quarter) */
    growth(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<GrowthResponse>("/growth", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 5 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Income Statement Growth (Specific) */
    incomeStatementGrowth(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<GrowthResponse>("/income-statement-growth", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 5 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Cash Flow Statement (Full) */
    cashFlowStatement(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<CashFlowResponse>("/cash-flow-statement", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 5 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Income Statement (Full) */
    incomeStatement(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<any[]>("/income-statement", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 50 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Performance (retornos, vol y drawdown) */
    performance(symbol: string, cache: CacheOpt = "force-cache") {
      return get<PerformanceResponse>("/performance", { params: { symbol }, cache });
    },

    /** Dividendos normalizados */
    dividends(symbol: string, cache: CacheOpt = "force-cache") {
      return get<DividendsResponse>("/dividends", { params: { symbol }, cache });
    },

    /** EOD (candles) – evitamos cache del lado browser para gráficos */
    eod(symbol: string, opts?: { limit?: number; cache?: CacheOpt }) {
      return get<EodResponse>("/eod", {
        params: { symbol, ...(opts?.limit ? { limit: opts.limit } : {}) },
        cache: opts?.cache ?? "no-store",
      });
    },

    /** Valuation (múltiplos consolidados) */
    valuation(
      symbol: string,
      opts?: { period?: "annual" | "quarter" | "ttm" | "FY" | "Q1" | "Q2" | "Q3" | "Q4"; cache?: CacheOpt }
    ) {
      return get<ValuationResponse>("/valuation", {
        params: { symbol, period: opts?.period ?? "annual" },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Scores (stable/financial-scores) */
    scores(symbol: string, cache: CacheOpt = "force-cache") {
      return get<FinancialScoreResponse>("/financial-scores", { params: { symbol }, cache });
    },

    /** Key metrics TTM */
    keyMetricsTTM(symbol: string, cache: CacheOpt = "force-cache") {
      return get<KeyMetricsResponse>("/key-metrics-ttm", { params: { symbol }, cache });
    },

    /** Key Metrics (Historical) */
    keyMetrics(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<KeyMetricsResponse>("/key-metrics", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 10 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Income Statement */
    incomeStatement(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<any[]>("/income-statement", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 5 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Balance Sheet Statement */
    balanceSheet(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<any[]>("/balance-sheet-statement", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 5 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Cash-flow (annual/quarter) */
    cashflow(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<CashFlowResponse>("/cashflow", {
        params: { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 8 },
        cache: opts?.cache ?? "force-cache",
      });
    },

    /** Quote en tiempo real */
    quote(symbol: string, opts?: { cache?: CacheOpt }) {
      return get<any[]>("/quote", {
        params: { symbol },
        cache: opts?.cache ?? "no-cache", // Sin cache para datos en tiempo real
      });
    },

    /** Stock Price Change */
    stockPriceChange(symbol: string, opts?: { cache?: CacheOpt }) {
      return get<any[]>(`/stock-price-change/${symbol}`, {
        cache: opts?.cache ?? "no-cache",
      });
    },

    /** 1. Obtener lista de todos los índices soportados */
    availableIndexes(cache: CacheOpt = "force-cache") {
      return get<any[]>("/available-indexes", { cache });
    },

    /** 2. Obtener histórico de un índice (Reutiliza lógica EOD) */
    indexHistoricalPrice(symbol: string, opts?: { limit?: number; cache?: CacheOpt }) {
      return get<EodResponse>("/eod", {
        params: { symbol, ...(opts?.limit ? { limit: opts.limit } : {}) },
        cache: opts?.cache ?? "no-store",
      });
    },

    /** 3. Obtener cotización actual de índice */
    indexQuote(symbol: string, opts?: { cache?: CacheOpt }) {
      return get<any[]>("/quote", {
        params: { symbol },
        cache: opts?.cache ?? "no-cache",
      });
    },

    balanceSheetGrowth(symbol: string, opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }) {
      return get<BalanceSheetGrowthResponse>("/balance-sheet-growth", {
        params: { symbol, period: opts?.period || "annual", limit: opts?.limit || 5 },
        cache: opts?.cache,
      });
    },

    institutionalHolders(symbol: string, cache: CacheOpt = "force-cache") {
      return get<InstitutionalHoldersResponse>("/institutional-holders", { params: { symbol }, cache });
    },

    insiderTrading(symbol: string, opts?: { limit?: number; cache?: CacheOpt }) {
      return get<InsiderTradingResponse>("/insider-trading", {
        params: { symbol, ...(opts?.limit ? { limit: opts.limit } : {}) },
        cache: opts?.cache,
      });
    },
    marketHours(opts?: { cache?: CacheOpt }) {
      return get<MarketHoursResponse>("/market-hours", { cache: opts?.cache ?? "force-cache" });
    },
    
    allMarketHours(opts?: { cache?: CacheOpt }) {
      return get<AllMarketHoursResponse>("/all-exchange-market-hours", { cache: opts?.cache ?? "force-cache" });
    },

    priceTargetConsensus(symbol: string, opts?: { cache?: CacheOpt }) {
      return get<import("@/lib/fmp/types").PriceTargetConsensus[]>(
        "/price-target-consensus",
        { params: { symbol }, cache: opts?.cache ?? "force-cache" }
      );
    },

    /** Generic fetch for unmapped endpoints */
    fetch<T>(path: string, opts?: GetOpts) {
      return get<T>(path, opts);
    },
  };
}
