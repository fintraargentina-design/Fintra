// /app/api/fmp/peers/detailed/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AnyJson = any;

const BASE_URL = process.env.FMP_BASE_URL || "https://financialmodelingprep.com";
const API_KEY = process.env.FMP_API_KEY;

type Query = Record<string, string | number | boolean | undefined>;

function buildUrl(path: string, query: Query = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  if (API_KEY) url.searchParams.set("apikey", API_KEY);
  return url.toString();
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
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
      return res;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      attempt++;
    }
  }
  throw lastErr ?? new Error("Fetch retry agotado");
}

async function fmpGetLocal(path: string, query: Query = {}) {
  if (!API_KEY) {
    throw new Error("FMP_API_KEY ausente en el servidor");
  }
  const url = buildUrl(path, query);
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FMP ${res.status} ${res.statusText} — ${text}`);
  }
  return res.json() as Promise<AnyJson>;
}

function extractPeers(raw: AnyJson): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first?.peersList && Array.isArray(first.peersList)) {
      return first.peersList.filter((p: unknown): p is string => typeof p === "string");
    }
    if (raw.every((x) => typeof x === "string")) return raw as string[];
    const fromObjs = raw
      .flatMap((o) =>
        Array.isArray(o?.peersList)
          ? o.peersList
          : typeof o?.peer === "string"
          ? [o.peer]
          : []
      )
      .filter((p: unknown): p is string => typeof p === "string");
    if (fromObjs.length) return fromObjs;
  } else if (typeof raw === "object") {
    if (Array.isArray((raw as any).peersList)) {
      return (raw as any).peersList.filter((p: unknown): p is string => typeof p === "string");
    }
  }
  return [];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const limit = Number(searchParams.get("limit") ?? 10);

  if (!symbol) {
    return NextResponse.json({ error: "Missing ?symbol" }, { status: 400 });
  }

  try {
    // peers con fallback de endpoints
    const attempts = [
      { path: "/stable/stock-peers", note: "stable/stock-peers" },
      { path: "/api/v4/stock_peers", note: "v4/stock_peers" },
      { path: "/api/v3/stock_peers", note: "v3/stock_peers" },
    ];
    let peers: string[] = [];
    const errors: string[] = [];

    for (const a of attempts) {
      try {
        const raw = await fmpGetLocal(a.path, { symbol });
        peers = extractPeers(raw)
          .map((p) => p.toUpperCase())
          .filter((p) => p !== symbol);
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        errors.push(`${a.note}: ${msg}`);
        if (/FMP\s+403/.test(msg) || /FMP\s+404/.test(msg)) {
          console.warn(`[FMP peers detailed] ${a.note} -> ${msg}. Usando peers vacíos.`);
          peers = [];
          break;
        }
      }
    }

    const trimmed = peers.slice(0, Math.max(1, limit));
    if (!trimmed.length) {
      return NextResponse.json({ symbol, peers: [] }, { status: 200 });
    }

    // perfiles batch
    const csv = trimmed.join(",");
    const profiles: any[] = await fmpGetLocal(`/api/v3/profile/${csv}`);

    const map = (profiles || []).map((p: any) => ({
      symbol: p.symbol,
      companyName: p.companyName,
      price: p.price,
      mktCap: p.mktCap,
      beta: p.beta,
      sector: p.sector,
      industry: p.industry,
      currency: p.currency,
      image: p.image,
    }));

    return NextResponse.json({ symbol, peers: map }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Detailed peers fetch failed" },
      { status: 500 }
    );
  }
}
