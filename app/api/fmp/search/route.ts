import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const query = (sp.get("query") ?? "").trim();
  const rawLimit = sp.get("limit") ?? "10";
  const exchange = sp.get("exchange") ?? undefined;

  // Frontend allows searching with 1 char, so we support it here too
  if (query.length < 1) {
    return NextResponse.json([], { status: 200 });
  }

  const limitNum = Math.min(Math.max(parseInt(rawLimit, 10) || 10, 1), 50);
  // Use environment variable or fallback to the key provided by user for debugging
  const apiKey = process.env.FMP_API_KEY || "scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V";

  if (!apiKey) {
      console.error("[/api/fmp/search] No API key configured");
      return NextResponse.json([], { status: 200 });
  }

  try {
    // Explicitly use the full URL to avoid base URL issues in fmpGet
    // Endpoint: https://financialmodelingprep.com/stable/search-symbol
    const url = new URL("https://financialmodelingprep.com/stable/search-symbol");
    url.searchParams.set("query", query);
    url.searchParams.set("limit", limitNum.toString());
    if (exchange) url.searchParams.set("exchange", exchange);
    url.searchParams.set("apikey", apiKey);

    const res = await fetch(url.toString(), {
        next: { revalidate: 600 } // Cache FMP response for 10 minutes
    });

    if (!res.ok) {
        throw new Error(`FMP error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    
    // Ensure we return an array
    return NextResponse.json(Array.isArray(data) ? data : [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/search] error:", err?.message || err);
    return NextResponse.json([], { status: 200 });
  }
}
