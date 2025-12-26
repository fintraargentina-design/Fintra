// /app/api/fmp/profile/route.ts
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
    .regex(/^[A-Z0-9.\-\^,]+$/i, "Símbolo inválido") // ✅ regex ANTES de transform
    .transform((s) => s.toUpperCase()),
});

export const revalidate = 43200; // 12 horas en segundos

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = QuerySchema.safeParse({ symbol: sp.get("symbol") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const { symbol } = parsed.data;

  try {
    // FMP: /stable/profile?symbol={symbol}
    const data = await fmpGet<any[]>(`/stable/profile`, { symbol });

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/profile] error:", err?.message || err);
    // Shape estable para no romper el cliente
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
        "X-Fallback": "true",
      },
    });
  }
}
