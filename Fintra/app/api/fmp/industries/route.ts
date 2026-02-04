import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // FMP Industries List API: /api/v3/industries-list
    const data = await fmpGet<string[]>("/api/v3/industries-list");
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("FMP Industries Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
