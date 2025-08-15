import { NextResponse } from "next/server";
import { fmpServer } from "@/lib/fmp/server";
export async function GET(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol requerido" }, { status: 400 });
  try {
    const raw = await fmpServer.peers(symbol);
    const peers = Array.isArray(raw) ? raw.map((p:any)=>p.symbol).filter(Boolean) : raw?.peers ?? [];
    return NextResponse.json({ symbol, peers });
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
