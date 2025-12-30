import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const revalidate = 86400; // 24 hours

export async function GET(req: Request) {
  try {
    const data = await fmpGet<any[]>(`/api/v4/market_risk_premium`);

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/market_risk_premium] error:", err?.message || err);
    return NextResponse.json([], {
      status: 200,
    });
  }
}
