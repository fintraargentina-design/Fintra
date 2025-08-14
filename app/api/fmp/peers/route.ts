// app/api/fmp/peers/route.ts
import { NextResponse } from "next/server";

const BASE_URL = process.env.FMP_BASE_URL ?? "https://financialmodelingprep.com";
const API_KEY = process.env.FMP_API_KEY; // <- debe existir en .env(.local)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "symbol requerido" }, { status: 400 });
  }
  if (!API_KEY) {
    // Esto es lo que estás viendo ahora mismo
    return NextResponse.json(
      { error: "FMP_API_KEY ausente en el servidor" },
      { status: 500 }
    );
  }

  const url = `${BASE_URL}/stable/stock-peers?symbol=${encodeURIComponent(
    symbol
  )}&apikey=${API_KEY}`;

  try {
    const r = await fetch(url, { next: { revalidate: 300 } }); // cache 5 min (opcional)
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        { error: "FMP upstream error", status: r.status, body: text },
        { status: 502 }
      );
    }

    // La API /stable/stock-peers devuelve un array de objetos { symbol, ... }
    const data = await r.json();
    const peers = Array.isArray(data)
      ? data.map((p: any) => p?.symbol).filter(Boolean)
      : [];

    return NextResponse.json({ symbol, peers }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "fetch_failed", message: e?.message ?? "unknown" },
      { status: 502 }
    );
  }
}
