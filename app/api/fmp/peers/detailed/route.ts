// /app/api/fmp/peers/detailed/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/client";
import { DetailedPeer, DetailedPeersResponse } from "@/lib/fmp/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const limit = Number(searchParams.get("limit") ?? 10);

  if (!symbol) {
    return NextResponse.json({ error: "Missing ?symbol" }, { status: 400 });
  }

  try {
    // 1) peers
    const raw: any = await fmpGet("/stable/stock-peers", { symbol });
    const peersList: string[] =
      Array.isArray(raw) ? (raw[0]?.peersList ?? []) : (raw?.peersList ?? []);

    const peers = (peersList || [])
      .filter((p: unknown): p is string => typeof p === "string")
      .filter((p: string) => p.toUpperCase() !== symbol)
      .slice(0, Math.max(1, limit));

    if (!peers.length) {
      return NextResponse.json({ symbol, peers: [] }, { status: 200 });
    }

    // 2) perfiles en batch
    const csv = peers.join(",");
    const profiles: any[] = await fmpGet(`/api/v3/profile/${csv}`);

    const map: DetailedPeer[] = (profiles || []).map((p: any) => ({
      symbol: p.symbol,
      companyName: p.companyName,
      price: p.price,
      mktCap: p.mktCap,
      beta: p.beta,
      sector: p.sector,
      industry: p.industry,
      currency: p.currency,
      image: p.image,
    }));

    const payload: DetailedPeersResponse = {
      symbol,
      peers: map,
    };
    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Detailed peers fetch failed" },
      { status: 500 }
    );
  }
}
