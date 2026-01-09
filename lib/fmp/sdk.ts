// /lib/fmp/sdk.ts
import type {
  PeersResponse,
  DetailedPeersResponse,
  RatiosResponse,
  GrowthResponse,
  ProfileResponse,
  PerformanceResponse,
  DividendsResponse,
  EodResponse,
  ValuationResponse,
  FinancialScoreResponse,
  KeyMetricsResponse,
  CashFlowResponse,
  ScreenerResponse,
  SearchResponse,
} from "./types";

type CacheOpt = RequestCache | undefined;

function buildQS(params: Record<string, any> = {}) {
  const qs = new URLSearchParams(params as any).toString();
  return qs ? `?${qs}` : "";
}

async function get<T>(
  path: string,
  params?: Record<string, any>,
  cache: CacheOpt = "no-store"
): Promise<T> {
  const url = `/api/fmp${path}${buildQS(params)}`;
  const res = await fetch(url, { cache });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${path} ${res.status} ${res.statusText} ${txt.slice(0, 160)}`);
  }
  return res.json() as Promise<T>;
}

/* ─────────────────── Peers ─────────────────── */

export async function apiPeers(
  symbol: string,
  opts?: { limit?: number; detailed?: boolean; cache?: CacheOpt }
): Promise<PeersResponse> {
  return get<PeersResponse>(
    "/peers",
    {
      symbol,
      ...(opts?.limit ? { limit: opts.limit } : {}),
      ...(opts?.detailed ? { detailed: 1 } : {}),
    },
    opts?.cache ?? "force-cache"
  );
}

export async function apiPeersDetailed(
  symbol: string,
  limit = 10,
  cache: CacheOpt = "force-cache"
): Promise<DetailedPeersResponse> {
  return get<DetailedPeersResponse>("/peers/detailed", { symbol, limit }, cache);
}

/* ─────────────────── Ratios / Growth / Profile ─────────────────── */

export async function apiRatios(
  symbol: string,
  opts?: { limit?: number; period?: "annual" | "quarter"; cache?: CacheOpt }
): Promise<RatiosResponse> {
  return get<RatiosResponse>(
    "/ratios",
    { symbol, limit: opts?.limit ?? 1, period: opts?.period ?? "annual" },
    opts?.cache ?? "force-cache"
  );
}

export async function apiGrowth(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit = 5,
  cache: CacheOpt = "force-cache"
): Promise<GrowthResponse> {
  return get<GrowthResponse>("/growth", { symbol, period, limit }, cache);
}

export async function apiProfile(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<ProfileResponse> {
  return get<ProfileResponse>("/profile", { symbol }, cache);
}

/* ─────────────────── Performance / Dividends / EOD / Valuation ─────────────────── */

export async function apiPerformance(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<PerformanceResponse> {
  return get<PerformanceResponse>("/performance", { symbol }, cache);
}

export async function apiDividends(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<DividendsResponse> {
  return get<DividendsResponse>("/dividends", { symbol }, cache);
}

export async function apiEod(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<EodResponse> {
  return get<EodResponse>("/eod", { symbol }, cache);
}

export async function apiValuation(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<ValuationResponse> {
  return get<ValuationResponse>("/valuation", { symbol }, cache);
}

export async function apiFinancialScore(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<FinancialScoreResponse> {
  return get<FinancialScoreResponse>("/financial-score", { symbol }, cache);
}

export async function apiKeyMetrics(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<KeyMetricsResponse> {
  return get<KeyMetricsResponse>("/key-metrics", { symbol }, cache);
}

export async function apiCashFlow(
  symbol: string,
  cache: CacheOpt = "force-cache"
): Promise<CashFlowResponse> {
  return get<CashFlowResponse>("/cash-flow", { symbol }, cache);
}

/* ─────────────────── Screener ─────────────────── */

export async function apiScreener(
  params: Record<string, any>,
  cache: CacheOpt = "force-cache"
): Promise<ScreenerResponse> {
  return get<ScreenerResponse>("/screener", params, cache);
}

export async function apiIndustries(
  cache: CacheOpt = "force-cache"
): Promise<string[]> {
  return get<string[]>("/industries", undefined, cache);
}

/* ─────────────────── Search ─────────────────── */

export async function apiSearch(
  query: string,
  limit = 10,
  exchange?: string,
  cache: CacheOpt = "no-store"
): Promise<SearchResponse> {
  return get<SearchResponse>("/search", { query, limit, exchange }, cache);
}
