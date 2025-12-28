import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Symbol required" }, { status: 400 });
  }

  try {
    // Endpoint: /v3/institutional-holder/{symbol}
    const data = await fmpGet<any[]>(`/api/v3/institutional-holder/${symbol}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching institutional holders:", error);
    return NextResponse.json([], { status: 500 });
  }
}
