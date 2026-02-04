import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "symbol requerido")
    .transform((s) => s.toUpperCase()),
});

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { symbol } = QuerySchema.parse({
      symbol: sp.get("symbol") ?? "",
    });

    // FMP: /price-target-consensus?symbol={symbol}
    // API endpoint is usually /v4/price-target-consensus?symbol=...
    const data = await fmpGet<any[]>(
      `/api/v4/price-target-consensus`,
      { symbol }
    );

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600", // 24h
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/price-target-consensus] error:", err?.message || err);
    return NextResponse.json([], { status: 200 });
  }
}
