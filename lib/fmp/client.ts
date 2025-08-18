// /lib/fmp/client.ts
import type { PeersResponse } from '@/lib/types';

type CacheOpt = RequestCache | undefined;
type GetOpts = { params?: Record<string, any>; cache?: CacheOpt };

async function get<T>(path: string, { params = {}, cache }: GetOpts = {}): Promise<T> {
  const qs = new URLSearchParams(params as any).toString();
  const url = `/api/fmp${path}${qs ? `?${qs}` : ''}`;
  const init: RequestInit = {};
  if (cache) init.cache = cache;               // solo seteamos si viene
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export const fmp = {
  peers(symbol: string, opts?: { limit?: number; detailed?: boolean; cache?: CacheOpt }) {
    return get<PeersResponse>('/peers', {
      params: { symbol, ...(opts?.limit ? { limit: opts.limit } : {}), ...(opts?.detailed ? { detailed: 1 } : {}) },
      cache: opts?.cache ?? 'force-cache',
    });
  },
  ratios(symbol: string, opts?: { limit?: number; cache?: CacheOpt }) {
    return get<any[]>('/ratios', {
      params: { symbol, limit: opts?.limit ?? 1 },
      cache: opts?.cache ?? 'force-cache',
    });
  },
  profile(symbol: string, opts?: { cache?: CacheOpt }) {
    return get<any[]>('/profile', {
      params: { symbol },
      cache: opts?.cache ?? 'force-cache',
    });
  },
  growth(symbol: string, opts?: { period?: 'annual' | 'quarter'; limit?: number; cache?: CacheOpt }) {
    return get<any[]>('/growth', {
      params: { symbol, period: opts?.period ?? 'annual', limit: opts?.limit ?? 5 },
      cache: opts?.cache ?? 'force-cache',
    });
  },
};
