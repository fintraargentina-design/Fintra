import { NextResponse } from 'next/server';
import { z } from 'zod';

const FMP_BASE_URL = process.env.FMP_BASE_URL ?? 'https://financialmodelingprep.com/';
const FMP_API_KEY = process.env.FMP_API_KEY!;

const QuerySchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z.\-]+$/, 'Símbolo inválido'),
  limit: z.coerce.number().int().positive().max(100).default(20),
  detailed: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional()
    .transform((v) => (v === '1' || v === 'true') ? true : false),
});

type PeerDetail = { symbol: string; companyName?: string; price?: number; mktCap?: number };
type PeersResponse = {
  symbol: string;
  peers: string[];
  source: 'fmp';
  updatedAt: string;
  details?: PeerDetail[]; // presente si detailed=1 y el backend lo pudo derivar
};

export const revalidate = 60 * 60 * 24;

function buildUrl(path: string, params: Record<string, string | number>) {
  const url = new URL(`${FMP_BASE_URL}${path.startsWith('/api') ? path : `/api${path}`}`);
  Object.entries({ ...params, apikey: FMP_API_KEY }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url.toString();
}

async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 2, timeoutMs = 10_000) {
  let attempt = 0;
  let lastErr: unknown;
  while (attempt <= retries) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal, cache: 'no-store' });
      clearTimeout(t);
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        attempt++;
        continue;
      }
      return res; // 4xx no reintenta
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      attempt++;
    }
  }
  throw lastErr ?? new Error('Fetch retry agotado');
}

/** Normaliza distintos formatos de respuesta de FMP a string[] de tickers y, si hay, detalles */
function extractPeers(raw: any): { tickers: string[]; details?: PeerDetail[] } {
  // 1) { peersList: [...] }
  if (raw && Array.isArray(raw.peersList)) {
    return { tickers: raw.peersList as string[] };
  }

  // 2) [ { peersList: [...] } ]
  if (Array.isArray(raw) && raw.length && Array.isArray(raw[0]?.peersList)) {
    return { tickers: raw[0].peersList as string[] };
  }

  // 3) [ { peer: "MSFT" }, ... ]
  if (Array.isArray(raw) && raw.length && Object.prototype.hasOwnProperty.call(raw[0], 'peer')) {
    const tickers = (raw as any[]).map((r) => r?.peer).filter(Boolean);
    return { tickers };
  }

  // 4) [ { symbol: "SONY", companyName: "...", price: ..., mktCap: ... }, ... ]
  if (Array.isArray(raw) && raw.length && Object.prototype.hasOwnProperty.call(raw[0], 'symbol')) {
    const details: PeerDetail[] = (raw as any[])
      .map((r) => ({
        symbol: String(r?.symbol ?? '').toUpperCase(),
        companyName: r?.companyName ?? undefined,
        price: typeof r?.price === 'number' ? r.price : Number.isFinite(+r?.price) ? +r.price : undefined,
        mktCap: typeof r?.mktCap === 'number' ? r.mktCap : Number.isFinite(+r?.mktCap) ? +r.mktCap : undefined,
      }))
      .filter((d) => !!d.symbol);

    const tickers = details.map((d) => d.symbol);
    return { tickers, details };
  }

  // 5) Nada reconocido
  return { tickers: [] };
}

export async function GET(req: Request) {
  if (!FMP_API_KEY) {
    return NextResponse.json({ error: 'Missing FMP_API_KEY' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    symbol: searchParams.get('symbol') ?? '',
    limit: searchParams.get('limit') ?? '20',
    detailed: searchParams.get('detailed') ?? '0',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { symbol, limit, detailed } = parsed.data;

  try {
    // 1) v4 recomendado
    const v4Url = buildUrl('/v4/stock_peers', { symbol, limit });
    let res = await fetchWithRetry(v4Url);
    let raw = res.ok ? await res.json() : null;
    console.log('[FMP peers url]', v4Url.replace(/(apikey=)[^&]+/, '$1***'));

    // 2) Fallback v3 si no hubo datos
    if (!raw || (Array.isArray(raw) && raw.length === 0)) {
      const v3Url = buildUrl('/v3/stock_peers', { symbol });
      res = await fetchWithRetry(v3Url);
      raw = res.ok ? await res.json() : null;
      console.log('[FMP peers url v3]', v3Url.replace(/(apikey=)[^&]+/, '$1***'));
    }

    const { tickers, details } = extractPeers(raw);
    const clean = Array.from(
      new Set(
        (tickers ?? [])
          .map((p) => String(p).trim().toUpperCase())
          .filter((p) => p && p !== symbol)
      )
    ).sort();

    const payload: PeersResponse = {
      symbol,
      peers: clean,
      source: 'fmp',
      updatedAt: new Date().toISOString(),
      ...(detailed && details ? { details: details.filter((d) => clean.includes(d.symbol)) } : {}),
    };

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    const payload: PeersResponse = {
      symbol,
      peers: [],
      source: 'fmp',
      updatedAt: new Date().toISOString(),
    };
    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
        'X-Fallback': 'true',
      },
    });
  }
}
