import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache for 1 hour (3600s)
const CACHE_TTL = 3600;

export async function GET() {
  try {
    const data = await fmpGet<any[]>("/stable/all-exchange-market-hours");
    
    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=${CACHE_TTL}`,
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/all-exchange-market-hours] error:", err?.message || err);
    return NextResponse.json([], { status: 200 });
  }
}
