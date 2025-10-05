import { NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const query = (sp.get("query") ?? "").trim();
  const rawLimit = sp.get("limit") ?? "10";
  const exchange = sp.get("exchange") ?? undefined;

  // Si no hay texto suficiente, devolver vacío para no consultar upstream
  if (query.length < 2) {
    return NextResponse.json([], { status: 200 });
  }

  const limitNum = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 50);

  try {
    // FMP: /api/v3/search — devuelve objetos con { symbol, name, exchangeShortName, stockExchange }
    const data = await fmpGet<any[]>(
      "/api/v3/search",
      { query, limit: limitNum, exchange }
    );

    return NextResponse.json(Array.isArray(data) ? data : [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/search] error:", err?.message || err);
    // Shape estable: lista vacía para no romper el dropdown
    return NextResponse.json([], { status: 200 });
  }
}