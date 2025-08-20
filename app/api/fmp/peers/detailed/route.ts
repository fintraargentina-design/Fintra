// app/api/fmp/peers/detailed/route.ts
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validación de query
const Query = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "symbol requerido")
    .transform((s) => s.toUpperCase())
    .regex(/^[A-Z0-9.\-\^]+$/, "símbolo inválido"),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// Normaliza payloads distintos de FMP → array de tickers
function extractPeers(raw: any): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    const first = raw[0];

    // v3/v4: [{ peersList: [...] }]
    if (first?.peersList && Array.isArray(first.peersList)) {
      return first.peersList.filter((p: unknown): p is string => typeof p === "string");
    }

    // A veces viene como array de strings
    if (raw.every((x) => typeof x === "string")) return raw as string[];

    // Objetos con peersList/peer
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

const cacheHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900", // 30m
};

export async function GET(req: NextRequest) {
  try {
    const { symbol, limit } = Query.parse(
      Object.fromEntries(new URL(req.url).searchParams)
    );

    // Intentos con fallback
    const attempts = [
      { path: "/stable/stock-peers", note: "stable/stock-peers" },
      { path: "/api/v4/stock_peers", note: "v4/stock_peers" },
      { path: "/api/v3/stock_peers", note: "v3/stock_peers" },
    ];

    let peers: string[] = [];
    for (const a of attempts) {
      try {
        const raw = await fmpGet<any>(a.path, { symbol });
        peers = Array.from(
          new Set(extractPeers(raw).map((p) => p.toUpperCase()))
        ).filter((p) => p !== symbol);
        if (peers.length) break;
      } catch (e: any) {
        // seguimos con el siguiente intento
        // si quisieras frenar por 403/404, podés inspeccionar e.message
        // console.warn(`[peers detailed] ${a.note} -> ${e?.message || e}`);
      }
    }

    const trimmed = peers.slice(0, limit);
    if (!trimmed.length) {
      return NextResponse.json({ symbol, peers: [] }, { status: 200, headers: cacheHeaders });
    }

    // Batch profile de los peers
    const csv = trimmed.join(",");
    const profiles = await fmpGet<any[]>(`/api/v3/profile/${csv}`);

    const mapped = (Array.isArray(profiles) ? profiles : []).map((p) => ({
      symbol: p.symbol,
      companyName: p.companyName ?? p.company ?? null,
      price: Number.isFinite(+p.price) ? +p.price : null,
      mktCap: Number.isFinite(+p.mktCap ?? +p.marketCap)
        ? (+p.mktCap ?? +p.marketCap)
        : null,
      beta: Number.isFinite(+p.beta) ? +p.beta : null,
      sector: p.sector ?? null,
      industry: p.industry ?? null,
      currency: p.currency ?? null,
      image: p.image ?? null,
    }));

    return NextResponse.json(
      { symbol, peers: mapped },
      { status: 200, headers: cacheHeaders }
    );
  } catch (err: any) {
    console.error("[/api/fmp/peers/detailed] error:", err?.message || err);
    // Shape estable para no romper la UI
    return NextResponse.json(
      { symbol: "", peers: [] },
      { status: 200, headers: cacheHeaders }
    );
  }
}
