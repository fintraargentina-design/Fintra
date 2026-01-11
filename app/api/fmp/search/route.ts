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
    // And fallback/merge with: https://financialmodelingprep.com/stable/search-name
    
    const symbolUrl = new URL("https://financialmodelingprep.com/stable/search-symbol");
    symbolUrl.searchParams.set("query", query);
    symbolUrl.searchParams.set("limit", limitNum.toString());
    if (exchange) symbolUrl.searchParams.set("exchange", exchange);
    symbolUrl.searchParams.set("apikey", apiKey);

    const nameUrl = new URL("https://financialmodelingprep.com/stable/search-name");
    nameUrl.searchParams.set("query", query);
    nameUrl.searchParams.set("limit", limitNum.toString());
    if (exchange) nameUrl.searchParams.set("exchange", exchange);
    nameUrl.searchParams.set("apikey", apiKey);

    const [symbolRes, nameRes] = await Promise.all([
      fetch(symbolUrl.toString(), { next: { revalidate: 600 } }),
      fetch(nameUrl.toString(), { next: { revalidate: 600 } })
    ]);

    const symbolData = symbolRes.ok ? await symbolRes.json() : [];
    const nameData = nameRes.ok ? await nameRes.json() : [];

    const safeSymbolData = Array.isArray(symbolData) ? symbolData : [];
    const safeNameData = Array.isArray(nameData) ? nameData : [];

    // Merge and deduplicate by symbol
    const merged = [...safeSymbolData];
    const seen = new Set(safeSymbolData.map((x: any) => x.symbol));

    for (const item of safeNameData) {
      if (!seen.has(item.symbol)) {
        merged.push(item);
        seen.add(item.symbol);
      }
    }
    
    // Ensure we return an array
    return NextResponse.json(merged.slice(0, limitNum), {
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
