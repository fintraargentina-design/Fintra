// /app/api/fmp/profile/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

const FMP_BASE_URL = process.env.FMP_BASE_URL ?? 'https://financialmodelingprep.com/api';
const FMP_API_KEY = process.env.FMP_API_KEY!;

const QuerySchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z.\-]+$/),
});

function buildUrl(path: string, params: Record<string, string | number>) {
  const url = new URL(`${FMP_BASE_URL}${path.startsWith('/api') ? path : `/api${path}`}`);
  Object.entries({ ...params, apikey: FMP_API_KEY }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return url.toString();
}

export const revalidate = 60 * 60 * 12;

export async function GET(req: Request) {
  if (!FMP_API_KEY) return NextResponse.json({ error: 'Missing FMP_API_KEY' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ symbol: searchParams.get('symbol') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { symbol } = parsed.data;

  // profile: /v3/profile/{symbol}
  const url = buildUrl(`/v3/profile/${symbol}`, {});

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ error: `FMP ${res.status}` }, { status: res.status });
  const data = await res.json();

  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=3600',
    },
  });
}
