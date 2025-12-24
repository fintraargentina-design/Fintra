import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const revalidate = 600; // 10 minutos

export async function GET() {
  try {
    const data = await fmpGet<any>("/api/v3/is-the-market-open");
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/market-hours] error:", err?.message || err);
    return NextResponse.json({}, { status: 500 });
  }
}
