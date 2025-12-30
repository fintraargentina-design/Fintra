import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query: Record<string, any> = {};
    searchParams.forEach((value, key) => {
        query[key] = value;
    });

    const data = await fmpGet<any[]>(`/api/v3/stock-screener`, query);

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/stock-screener] error:", err?.message || err);
    return NextResponse.json([], {
      status: 200,
    });
  }
}
