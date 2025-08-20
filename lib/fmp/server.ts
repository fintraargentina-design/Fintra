// /lib/fmp/server.ts
import "server-only";

const BASE =
  (process.env.FMP_BASE_URL?.replace(/\/$/, "") as string) ||
  "https://financialmodelingprep.com";
const API_KEY = process.env.FMP_API_KEY; // sólo server

if (!API_KEY) {
  console.warn("[FMP] FMP_API_KEY no configurada en el servidor (.env).");
}

export type Query = Record<string, string | number | boolean | undefined>;

const DEFAULT_TIMEOUT = 12_000; // ms
const DEFAULT_RETRIES = 2;

function ensureLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildUrl(path: string, query: Query = {}) {
  const url = new URL(`${BASE}${ensureLeadingSlash(path)}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  if (API_KEY) url.searchParams.set("apikey", API_KEY);
  return url.toString();
}

function maskApiKey(u: string) {
  return u.replace(/(apikey=)[^&]+/i, "$1***");
}

async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  retries = DEFAULT_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT
) {
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: ac.signal, cache: "no-store" });
      clearTimeout(timer);

      if (res.ok) return res;

      // 429 y 5xx → reintenta con backoff+jitter
      if (res.status === 429 || res.status >= 500) {
        const delay = 400 * (attempt + 1) + Math.random() * 250;
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      // 4xx distintos de 429 → no reintentar
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const delay = 350 * (attempt + 1) + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }

  throw lastErr ?? new Error("Fetch retry agotado");
}

export async function fmpGet<T>(
  path: string,
  query: Query = {},
  opts?: { retries?: number; timeoutMs?: number; init?: RequestInit }
): Promise<T> {
  if (!API_KEY) throw new Error("FMP_API_KEY ausente en el servidor");
  const url = buildUrl(path, query);

  const res = await fetchWithRetry(
    url,
    opts?.init,
    opts?.retries ?? DEFAULT_RETRIES,
    opts?.timeoutMs ?? DEFAULT_TIMEOUT
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(
      `[FMP] ${res.status} ${res.statusText} — ${maskApiKey(url)} — ${txt.slice(0, 200)}`
    );
    throw new Error(`FMP ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as T;
}
