// /app/api/fmp/quote/route.ts
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
    .regex(/^[A-Z0-9.\-\^, =]+$/i, "Símbolo inválido (quote)")
    .transform((s) => s.toUpperCase()),
});

export const revalidate = 60; // 1 minuto para datos en tiempo real

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
    // FMP: /v3/quote/{symbol} — devuelve array con datos de cotización
    const data = await fmpGet<any[]>(`/api/v3/quote/${symbol}`);

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/quote] error:", err?.message || err);
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
      },
    });
  }
}