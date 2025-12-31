import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const paramsData = await params;
    const symbol = decodeURIComponent(paramsData.symbol).toUpperCase();
    
    // FMP: /stock-price-change/{symbol}
    // Note: FMP supports batching for this endpoint with comma-separated symbols
    const data = await fmpGet<any[]>(
      `/api/v3/stock-price-change/${symbol}`
    );

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/stock-price-change] error:", err?.message || err);
    return NextResponse.json([], { status: 200 });
  }
}
