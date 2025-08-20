// app/api/fmp/eod/route.ts
import { NextResponse } from "next/server";

const BASE = process.env.FMP_BASE_URL ?? "https://financialmodelingprep.com";
const KEY = process.env.FMP_API_KEY!;

type Row = { date?: string; datetime?: string; timestamp?: string; label?: string; open?: number; o?: number; high?: number; h?: number; low?: number; l?: number; close?: number; c?: number; volume?: number; };

function normDate(x: any) {
  const s = String(x ?? "").slice(0, 10);
  return s && s !== "Invalid Date" ? s : "";
}

function normalize(symbol: string, raw: any) {
  let rows: any[] | undefined;
  if (Array.isArray(raw)) rows = raw;
  else if (Array.isArray(raw?.historical)) rows = raw.historical;
  else if (Array.isArray(raw?.results)) rows = raw.results;
  else if (Array.isArray(raw?.[0]?.historical)) rows = raw[0].historical;

  const candles = (rows ?? [])
    .map((h: Row) => ({
      date: normDate(h.date ?? h.datetime ?? h.timestamp ?? h.label),
      open: Number(h.open ?? h.o),
      high: Number(h.high ?? h.h),
      low: Number(h.low ?? h.l),
      close: Number(h.close ?? h.c),
      volume: h.volume != null ? Number(h.volume) : undefined,
    }))
    .filter(
      (d) =>
        d.date &&
        Number.isFinite(d.open) &&
        Number.isFinite(d.high) &&
        Number.isFinite(d.low) &&
        Number.isFinite(d.close)
    )
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return { symbol, candles };
}

async function fetchText(url: string) {
  const r = await fetch(url, { cache: "no-store" });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { /* noop */ }
  return { ok: r.ok, status: r.status, text, json };
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const symbol = sp.get("symbol")?.toUpperCase();
  const limit = sp.get("limit") ? Math.max(1, Math.min(10000, Number(sp.get("limit")))) : undefined;

  if (!symbol) return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  if (!KEY)   return NextResponse.json({ error: "FMP_API_KEY missing" }, { status: 500 });

  const stableURL = `${BASE}/stable/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}&apikey=${KEY}`;
  const v3URL     = `${BASE}/api/v3/historical-price-full/${encodeURIComponent(symbol)}?apikey=${KEY}`;

  try {
    // 1) intento stable
    const a = await fetchText(stableURL);
    let premiumBlocked = false;

    if (!a.ok) {
      // premium/forbidden → probamos v3
      if (a.status === 402 || a.status === 403 || /Premium|forbidden/i.test(a.text)) {
        const b = await fetchText(v3URL);
        if (!b.ok) {
          // si v3 también bloqueado, devolvemos vacío pero 200 para no romper UI
          if (b.status === 402 || b.status === 403 || /Premium|forbidden/i.test(b.text)) {
            premiumBlocked = true;
            const out = normalize(symbol, { historical: [] });
            const sliced = limit ? { ...out, candles: out.candles.slice(-limit) } : out;
            return NextResponse.json(sliced, {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900",
                "X-Premium-Blocked": "true",
              },
            });
          }
          throw new Error(`FMP v3 ${b.status} ${b.text.slice(0, 160)}`);
        }
        const out = normalize(symbol, b.json);
        const sliced = limit ? { ...out, candles: out.candles.slice(-limit) } : out;
        return NextResponse.json(sliced, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900",
          },
        });
      }
      // otro error (no premium): reventamos controladamente
      throw new Error(`FMP stable ${a.status} ${a.text.slice(0, 160)}`);
    }

    // 2) stable OK
    const out = normalize(symbol, a.json);
    const sliced = limit ? { ...out, candles: out.candles.slice(-limit) } : out;
    return NextResponse.json(sliced, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900",
      },
    });
  } catch (err: any) {
    // Último fallback: no romper UI
    return NextResponse.json(
      { symbol, candles: [], error: err?.message ?? "Upstream FMP error" },
      { status: 200 }
    );
  }
}
