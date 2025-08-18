// /lib/fmp/server.ts
import "server-only";

const BASE = process.env.FMP_BASE_URL || "https://financialmodelingprep.com";
const API_KEY = process.env.FMP_API_KEY; // sólo server

if (!API_KEY) {
  console.warn("[FMP] FMP_API_KEY no configurada en el servidor (.env).");
}

export type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query: Query = {}) {
  const url = new URL(`${BASE}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  if (API_KEY) url.searchParams.set("apikey", API_KEY);
  return url.toString();
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2) {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    try {
      const res = await fetch(url, { ...init, cache: "no-store" });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        attempt++;
        continue;
      }
      return res; // otros 4xx sin retry
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      attempt++;
    }
  }
  throw lastErr ?? new Error("Fetch retry agotado");
}

export async function fmpGet<T>(path: string, query: Query = {}): Promise<T> {
  if (!API_KEY) throw new Error("FMP_API_KEY ausente en el servidor");
  const url = buildUrl(path, query);
  const r = await fetchWithRetry(url);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`FMP ${r.status} ${r.statusText} — ${txt}`);
  }
  return r.json() as Promise<T>;
}
