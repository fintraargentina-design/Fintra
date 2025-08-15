// lib/fmp/client.ts  (NO server-only; sin process.env)
const BASE = "/api/fmp";

type Params = Record<string, string | number | boolean | undefined>;

function toQs(params: Params) {
  const obj: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) obj[k] = String(v);
  }
  const qs = new URLSearchParams(obj).toString();
  return qs ? `?${qs}` : "";
}

async function get<T>(path: string, params: Params = {}): Promise<T> {
  const url = `${BASE}${path}${toQs(params)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}

import type { DetailedPeersResponse } from "@/lib/fmp/types";

export const fmp = {
  profile: (symbol: string) => get<any[]>(`/profile`, { symbol }),
  ratios:  (symbol: string) => get<any[]>(`/ratios`,  { symbol }),
  growth:  (symbol: string) => get<any[]>(`/growth`,  { symbol }),
  peers:   (symbol: string) =>
    get<{ symbol: string; peers: string[] }>(`/peers`, { symbol }),

  detailedPeers: (symbol: string, limit = 10) =>
    get<DetailedPeersResponse>(`/peers/detailed`, { symbol, limit }),

  // Actívalos solo si tienes los routes creados:
  // keyMetrics: (symbol: string) => get<any[]>(`/key-metrics`, { symbol }),
  // cashflow:   (symbol: string) => get<any[]>(`/cashflow`,   { symbol }),
};
