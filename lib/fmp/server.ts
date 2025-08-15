// lib/fmp/server.ts
import "server-only";

const BASE_URL = process.env.FMP_BASE_URL || "https://financialmodelingprep.com";
const API_KEY = process.env.FMP_API_KEY;

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query: Query = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(query).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));
  if (API_KEY) url.searchParams.set("apikey", API_KEY);
  return url.toString();
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0, lastErr: unknown;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, { ...init, cache: "no-store" });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        attempt++;
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      attempt++;
    }
  }
  throw lastErr ?? new Error("Fetch retry agotado");
}

export async function fmpGet<T>(path: string, query: Query = {}): Promise<T> {
  if (!API_KEY) throw new Error("FMP_API_KEY ausente en el servidor");
  const res = await fetchWithRetry(buildUrl(path, query));
  if (!res.ok) throw new Error(`FMP ${res.status} ${res.statusText}: ${await res.text().catch(()=> "")}`);
  return res.json() as Promise<T>;
}

// Endpoints de servidor (úsalos dentro de /app/api/fmp/**)
export const fmpServer = {
  profile:  (symbol: string) => fmpGet(`/api/v3/profile/${symbol}`),
  ratios:   (symbol: string) => fmpGet(`/api/v3/ratios/${symbol}`, { period: "annual", limit: 1 }),
  growth:   (symbol: string) => fmpGet(`/api/v3/income-statement-growth/${symbol}`, { period: "annual", limit: 5 }),
  peers:    (symbol: string) => fmpGet(`/stable/stock-peers`, { symbol }),
  keyMetrics: (symbol: string) => fmpGet(`/api/v3/key-metrics/${symbol}`, { period: "annual", limit: 1 }),
  cashflow:   (symbol: string) => fmpGet(`/api/v3/cash-flow-statement/${symbol}`, { period: "annual", limit: 1 }),
};
