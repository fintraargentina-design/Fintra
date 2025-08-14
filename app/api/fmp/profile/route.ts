// /app/api/fmp/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Missing ?symbol" }, { status: 400 });
  }

  try {
    const data = await fmpGet(`/api/v3/profile/${symbol}`);
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Profile fetch failed" },
      { status: 500 }
    );
  }
}
