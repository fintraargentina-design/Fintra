// /app/api/fmp/ratios/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const limit = Number(searchParams.get("limit") ?? 5);

  if (!symbol) {
    return NextResponse.json({ error: "Missing ?symbol" }, { status: 400 });
  }

  try {
    const data = await fmpGet(`/api/v3/ratios/${symbol}`, { limit });
    return NextResponse.json(Array.isArray(data) ? data : [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Ratios fetch failed" },
      { status: 500 }
    );
  }
}
