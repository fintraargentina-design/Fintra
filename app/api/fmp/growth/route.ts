// app/api/fmp/growth/route.ts
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
    .min(1, "symbol requerido")
    .regex(/^[A-Z.\-]+$/i, "símbolo inválido") // ✅ regex ANTES de transform
    .transform((s) => s.toUpperCase()),
  period: z.enum(["annual", "quarter"]).default("annual"),
  limit: z.coerce.number().int().positive().max(40).default(5),
});

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { symbol, period, limit } = QuerySchema.parse({
      symbol: sp.get("symbol") ?? "",
      period: sp.get("period") ?? "annual",
      limit: sp.get("limit") ?? "5",
    });

    // FMP: financial-growth
    // Devolvemos el payload tal cual (tu UI ya espera keys como growthRevenue, growthEPS, etc.)
    const data = await fmpGet<any[]>(
      `/stable/financial-growth`,
      { symbol, period, limit }
    );

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600", // 12h
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/growth] error:", err?.message || err);
    // Shape estable: array vacío para no romper el cliente
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  }
}
