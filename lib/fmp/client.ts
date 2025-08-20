// /lib/fmp/client.ts
import type {
  PeersResponse,
  PerformanceResponse,
  DividendsResponse,
  EodResponse,
  ProfileResponse,
  RatiosResponse,
  GrowthResponse,
  DetailedPeersResponse,
  FinancialScoreResponse,
  KeyMetricsResponse,
  CashFlowResponse,
} from "@/lib/fmp/types";

type CacheOpt = RequestCache | undefined;
type GetOpts = { params?: Record<string, any>; cache?: CacheOpt };

async function get<T>(path: string, { params = {}, cache }: GetOpts = {}): Promise<T> {
  const qs = new URLSearchParams(params as any).toString();
  const url = `/api/fmp${path}${qs ? `?${qs}` : ""}`;
  const init: RequestInit = {};
  if (cache) init.cache = cache;

  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} ${res.status} ${res.statusText} ${body.slice(0, 160)}`);
  }
  return res.json() as Promise<T>;
}

/** Tipado mínimo del /valuation para autocompletado.
 *  Si preferís, muévelo a /lib/fmp/types y expórtalo desde allí. */
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

export const fmp = {
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
  valuation(symbol: string, opts?: { period?: "annual" | "quarter"; cache?: CacheOpt }) {
    return get<ValuationResponse>("/valuation", {
      params: { symbol, period: opts?.period ?? "annual" },
      cache: opts?.cache ?? "force-cache",
    });
  },

  /** Scores (stable/financial-scores) */
  scores(symbol: string, cache: CacheOpt = "force-cache") {
    return get<FinancialScoreResponse>("/scores", { params: { symbol }, cache });
  },

  /** Key metrics TTM */
  keyMetricsTTM(symbol: string, cache: CacheOpt = "force-cache") {
    return get<KeyMetricsResponse>("/key-metrics", { params: { symbol }, cache });
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
};
