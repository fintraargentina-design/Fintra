// /lib/fmp/client.ts
import "server-only";

const BASE_URL = process.env.FMP_BASE_URL || "https://financialmodelingprep.com";
const API_KEY = process.env.FMP_API_KEY; // ⚠️ Server-side, NO public.

if (!API_KEY) {
  // No tiramos error para no romper build, pero en runtime devolveremos 500 si falta
  console.warn("[FMP] FMP_API_KEY no configurada en el servidor (.env).");
}

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query: Query = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  if (API_KEY) url.searchParams.set("apikey", API_KEY);
  return url.toString();
}

// Reintentos simples para 429/5xx
async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, { ...init, cache: "no-store" });
      if (res.ok) return res;
      // Retries para 429/5xx
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        attempt++;
        continue;
      }
      return res; // errores 4xx sin retry
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      attempt++;
    }
  }
  throw lastErr ?? new Error("Fetch retry agotado");
}

export async function fmpGet<T>(path: string, query: Query = {}): Promise<T> {
  if (!API_KEY) {
    throw new Error("FMP_API_KEY ausente en el servidor");
  }
  const url = buildUrl(path, query);
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FMP ${res.status} ${res.statusText} — ${text}`);
  }
  return res.json() as Promise<T>;
}

// lib/fmpClient.ts
export async function getPeers(symbol: string) {
  const r = await fetch(`/api/fmp/peers?symbol=${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Peers ${r.status}`);
  return r.json() as Promise<{ symbol: string; peers: string[] }>;
}
