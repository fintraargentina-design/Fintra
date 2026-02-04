import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fmpGet<any[]>("/api/v3/symbol/available-indexes");
    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=43200", // Cache 1 day
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/available-indexes] error:", err?.message || err);
    return NextResponse.json([], { status: 200 });
  }
}
