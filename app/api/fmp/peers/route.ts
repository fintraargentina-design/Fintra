// app/api/fmp/peers/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validación de query
const QuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Símbolo requerido")
    .regex(/^[A-Z0-9.\-\^]+$/i, "Símbolo inválido") // Mover regex antes de transform
    .transform((s) => s.toUpperCase()),
  limit: z.coerce.number().int().positive().max(100).default(20),
  detailed: z
    .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
    .optional()
    .transform((v) => (v === "1" || v === "true") ? true : false),
});

type PeerDetail = { symbol: string; companyName?: string; price?: number | null; mktCap?: number | null };
type PeersResponse = {
  symbol: string;
  peers: string[];
  source: "fmp";
  updatedAt: string;
  details?: PeerDetail[]; // presente si detailed=1
};

// Normaliza payloads distintos de FMP → lista de tickers
// Función extractPeers - remover estos logs:
function extractPeers(raw: any): string[] {
  // ... existing code ...
  
  if (!raw) return [];

  if (Array.isArray(raw)) {
    // v4: [{ peersList: [...] }]
    if (raw.length && Array.isArray(raw[0]?.peersList)) {
      return raw[0].peersList.filter((p: unknown): p is string => typeof p === "string");
    }
    // a veces devuelven array de strings
    if (raw.every((x) => typeof x === "string")) {
      return raw as string[];
    }
    
    // NUEVO: Manejar array de objetos con propiedad 'symbol'
    if (raw.length && typeof raw[0] === 'object' && 'symbol' in raw[0]) {
      const result = raw
        .map((obj: any) => obj.symbol)
        .filter((symbol: unknown): symbol is string => typeof symbol === "string" && symbol.trim().length > 0);
      return result;
    }
    
    // objetos con peersList/peer
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
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600", // 24h
};

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { symbol, limit, detailed } = QuerySchema.parse({
      symbol: sp.get("symbol") ?? "",
      limit: sp.get("limit") ?? "20",
      detailed: sp.get("detailed") ?? "0",
    });

    // Intentos con fallback: stable → v4 → v3
    const attempts = [
      { path: "/stable/stock-peers", note: "stable/stock-peers", params: { symbol } },
      { path: "/api/v4/stock_peers", note: "v4/stock_peers", params: { symbol, limit } },
      { path: "/api/v3/stock_peers", note: "v3/stock_peers", params: { symbol } },
    ];

    let peers: string[] = [];
    // En el bucle de intentos - remover estos logs:
    for (const a of attempts) {
      try {
        const raw = await fmpGet<any>(a.path, a.params as Record<string, any>);
        
        const extracted = extractPeers(raw);
        
        peers = Array.from(
          new Set(extracted.map((p) => String(p).trim().toUpperCase()))
        ).filter((p) => p && p !== symbol);
        
        if (peers.length) break;
      } catch (error) {
        // seguimos al siguiente intento
      }
    }

    // aplica límite final por si el endpoint no lo respeta
    const clean = peers.slice(0, limit).sort();

    // Si detailed=1, buscamos perfiles en batch (v3 profile soporta CSV)
    let details: PeerDetail[] | undefined;
    if (detailed && clean.length) {
      const csv = clean.join(",");
      const profRaw = await fmpGet<any[]>(`/api/v3/profile/${csv}`);
      const arr = Array.isArray(profRaw) ? profRaw : [];
      details = arr
        .map((p) => ({
          symbol: String(p.symbol ?? "").toUpperCase(),
          companyName: p.companyName ?? p.company ?? undefined,
          price: Number.isFinite(+p.price) ? +p.price : null,
          mktCap: Number.isFinite(+(p.mktCap ?? p.marketCap ?? 0)) ? +(p.mktCap ?? p.marketCap ?? 0) : 0,
        }))
        .filter((d) => !!d.symbol && clean.includes(d.symbol));
    }

    const payload: PeersResponse = {
      symbol,
      peers: clean,
      source: "fmp",
      updatedAt: new Date().toISOString(),
      ...(details ? { details } : {}),
    };

    return new NextResponse(JSON.stringify(payload), { status: 200, headers: cacheHeaders });
  } catch (err: any) {
    console.error("[/api/fmp/peers] error:", err?.message || err);
    // Shape estable para no romper UI
    const symbol = new URL(req.url).searchParams.get("symbol")?.toUpperCase() || "";
    const payload: PeersResponse = {
      symbol,
      peers: [],
      source: "fmp",
      updatedAt: new Date().toISOString(),
    };
    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: { ...cacheHeaders, "X-Fallback": "true" },
    });
  }
}
