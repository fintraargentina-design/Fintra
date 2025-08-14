// /lib/fmp/sdk.ts
import { DetailedPeersResponse, PeersResponse } from "./types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Peers simples (símbolos)
export async function apiPeers(symbol: string): Promise<PeersResponse> {
  return get(`/api/fmp/peers?symbol=${encodeURIComponent(symbol)}`);
}

// Peers detallados
export async function apiPeersDetailed(symbol: string, limit = 10): Promise<DetailedPeersResponse> {
  return get(`/api/fmp/peers/detailed?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
}

// Ratios
export async function apiRatios(symbol: string, limit = 5) {
  return get(`/api/fmp/ratios?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
}

// Growth
export async function apiGrowth(symbol: string, period: "annual" | "quarter" = "annual", limit = 5) {
  return get(`/api/fmp/growth?symbol=${encodeURIComponent(symbol)}&period=${period}&limit=${limit}`);
}

// Profile
export async function apiProfile(symbol: string) {
  return get(`/api/fmp/profile?symbol=${encodeURIComponent(symbol)}`);
}
