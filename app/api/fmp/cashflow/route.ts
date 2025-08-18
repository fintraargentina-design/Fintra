// app/api/fmp/cashflow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const limit = Number(searchParams.get("limit") ?? 8);
  const period = (searchParams.get("period") ?? "annual") as "annual" | "quarter";

  if (!symbol) return NextResponse.json({ error: "Missing ?symbol" }, { status: 400 });

  try {
    const data = await fmpGet<any[]>(`/api/v3/cash-flow/${symbol}`, { period, limit });
    return NextResponse.json(data ?? [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Cash-flow fetch failed" }, { status: 500 });
  }
}
