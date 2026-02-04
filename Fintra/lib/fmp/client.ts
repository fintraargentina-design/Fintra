// /lib/fmp/client.ts
import { createFmpClient, type GetOpts } from "./factory";
export type { ValuationResponse } from "./types"; // Re-export for compatibility

async function proxyFetcher<T>(path: string, { params = {}, cache }: GetOpts = {}): Promise<T> {
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

export const fmp = createFmpClient(proxyFetcher);
