// /lib/fmp/public.ts
// Cliente seguro para el navegador: SIEMPRE pega contra /api/fmp/* (server-side)

import type {
  RatiosResponse,
  GrowthResponse,
  ProfileResponse,
  PerformanceResponse,
  DividendsResponse,
  PeersResponse,
  EodResponse,
  ValuationResponse,
  FinancialScoreResponse,
  KeyMetricsResponse,
  CashFlowResponse,
} from "@/lib/fmp/types";

type CacheOpt = RequestCache | undefined;

function qs(params: Record<string, any> = {}) {
  const s = new URLSearchParams(params as any).toString();
  return s ? `?${s}` : "";
}

async function getJSON<T>(
  path: string,
  params?: Record<string, any>,
  cache: CacheOpt = "no-store"
): Promise<T> {
  const url = `/api/fmp${path}${qs(params)}`;
  const r = await fetch(url, { cache });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`${path} ${r.status} ${r.statusText} ${body.slice(0, 160)}`);
  }
  return (await r.json()) as T;
}

export const fmp = {
  /* ─────────── Lecturas principales ─────────── */

  ratios(
    symbol: string,
    opts?: { limit?: number; period?: "annual" | "quarter"; cache?: CacheOpt }
  ) {
    return getJSON<RatiosResponse>(
      "/ratios",
      { symbol, limit: opts?.limit ?? 1, period: opts?.period ?? "annual" },
      opts?.cache ?? "force-cache"
    );
  },

  growth(
    symbol: string,
    opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }
  ) {
    return getJSON<GrowthResponse>(
      "/growth",
      { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 5 },
      opts?.cache ?? "force-cache"
    );
  },

  profile(symbol: string, cache: CacheOpt = "force-cache") {
    return getJSON<ProfileResponse>("/profile", { symbol }, cache);
  },

  performance(symbol: string, cache: CacheOpt = "force-cache") {
    return getJSON<PerformanceResponse>("/performance", { symbol }, cache);
  },

  dividends(symbol: string, cache: CacheOpt = "force-cache") {
    return getJSON<DividendsResponse>("/dividends", { symbol }, cache);
  },

  peers(
    symbol: string,
    opts?: { limit?: number; detailed?: boolean; cache?: CacheOpt }
  ) {
    return getJSON<PeersResponse>(
      "/peers",
      {
        symbol,
        ...(opts?.limit ? { limit: opts.limit } : {}),
        ...(opts?.detailed ? { detailed: 1 } : {}),
      },
      opts?.cache ?? "force-cache"
    );
  },

  eod(
    symbol: string,
    opts?: { limit?: number; cache?: CacheOpt }
  ) {
    // Datos de precio histórico → preferimos no cachear en el browser
    return getJSON<EodResponse>(
      "/eod",
      { symbol, ...(opts?.limit ? { limit: opts.limit } : {}) },
      opts?.cache ?? "no-store"
    );
  },

  valuation(
    symbol: string,
    opts?: { period?: "annual" | "quarter"; cache?: CacheOpt }
  ) {
    return getJSON<ValuationResponse>(
      "/valuation",
      { symbol, period: opts?.period ?? "annual" },
      opts?.cache ?? "force-cache"
    );
  },

  /* ─────────── Extras (scores / métricas / cashflow) ─────────── */

  scores(symbol: string, cache: CacheOpt = "force-cache") {
    return getJSON<FinancialScoreResponse>("/scores", { symbol }, cache);
  },

  keyMetrics(symbol: string, cache: CacheOpt = "force-cache") {
    return getJSON<KeyMetricsResponse>("/key-metrics", { symbol }, cache);
  },

  cashflow(
    symbol: string,
    opts?: { period?: "annual" | "quarter"; limit?: number; cache?: CacheOpt }
  ) {
    return getJSON<CashFlowResponse>(
      "/cashflow",
      { symbol, period: opts?.period ?? "annual", limit: opts?.limit ?? 8 },
      opts?.cache ?? "force-cache"
    );
  },
};
