// /app/api/fmp/growth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const period = searchParams.get("period") ?? "annual";
  const limit = Number(searchParams.get("limit") ?? 5);

  if (!symbol) {
    return NextResponse.json({ error: "Missing ?symbol" }, { status: 400 });
  }

  try {
    const data = await fmpGet(`/api/v3/income-statement-growth/${symbol}`, {
      period,
      limit,
    });
    return NextResponse.json(Array.isArray(data) ? data : [], { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Growth fetch failed" },
      { status: 500 }
    );
  }
}
