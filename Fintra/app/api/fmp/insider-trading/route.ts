import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const limit = searchParams.get("limit") || "100";

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    // Endpoint: /v4/insider-trading?symbol={symbol}&limit={limit}
    const data = await fmpGet<any[]>(`/api/v4/insider-trading`, { symbol, limit });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching insider trading:", error);
    return NextResponse.json([], { status: 500 });
  }
}
