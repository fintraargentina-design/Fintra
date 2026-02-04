// app/api/fmp/key-metrics/route.ts
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "symbol requerido")
    .regex(/^[A-Z0-9.\-\^]+$/, "símbolo inválido")  // ← Validar ANTES
    .transform((s) => s.toUpperCase()),               // ← Transformar DESPUÉS
  // ttm = /key-metrics-ttm/{symbol}
  // annual = /key-metrics/{symbol}?period=annual&limit=...
  scope: z.enum(["ttm", "annual"]).default("ttm"),
  limit: z.coerce.number().int().positive().max(60).default(20),
});

export async function GET(req: NextRequest) {
  try {
    const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));

    let data: any;

    if (q.scope === "ttm") {
      // Devuelve típicamente un array con 1 objeto TTM
      data = await fmpGet<any[]>(`/stable/key-metrics-ttm`, { symbol: q.symbol });
    } else {
      // Histórico anual (period=annual, limit configurable)
      data = await fmpGet<any[]>(
        `/stable/key-metrics`,
        { symbol: q.symbol, period: "annual", limit: q.limit }
      );
    }

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600", // 12h
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/key-metrics] error:", err?.message || err);
    // Shape estable para no romper el cliente
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  }
}
