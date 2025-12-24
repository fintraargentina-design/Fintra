// app/api/fmp/ratios-ttm/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Símbolo requerido")
    .regex(/^[A-Za-z0-9.\-\^]+$/, "Símbolo inválido")
    .transform((s) => s.toUpperCase()),
});

export const revalidate = 43200; // 12 horas en segundos

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      symbol: searchParams.get("symbol") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { symbol } = parsed.data;
    
    // FMP: /stable/ratios-ttm?symbol={symbol}
    const data = await fmpGet<any[]>(`/stable/ratios-ttm`, { symbol });

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/ratios-ttm] error:", err?.message || err);
    return NextResponse.json([], { status: 200, headers: { "X-Fallback": "true" } });
  }
}
