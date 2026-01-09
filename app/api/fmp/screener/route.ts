import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());

  try {
    // FMP Screener API: /api/v3/stock-screener
    const data = await fmpGet<any[]>("/api/v3/stock-screener", query);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("FMP Screener Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
