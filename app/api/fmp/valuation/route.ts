// app/api/fmp/valuation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { fmpGet } from "@/lib/fmp/server";

export const dynamic = "force-dynamic";

// Limpia números tipo string a number o null
const num = (x: any) => (x == null || x === "" ? null : Number(x));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const period = (searchParams.get("period") ?? "annual") as "annual" | "quarter";

  if (!symbol) return NextResponse.json({ error: "Missing ?symbol" }, { status: 400 });

  try {
    // 1) ratios (último)
    const ratios = await fmpGet<any[]>(`/api/v3/ratios/${symbol}`, { limit: 1, period });
    const r = Array.isArray(ratios) && ratios.length ? ratios[0] : {};

    // 2) growth (para PEG/implied si lo quisieras luego)
    const growth = await fmpGet<any[]>(`/api/v3/income-statement-growth/${symbol}`, { limit: 5, period });

    const payload = {
      symbol,
      date: r.date ?? null,
      // múltiplos
      pe: num(r.priceEarningsRatio),
      forwardPe: num(r.forwardPE), // puede no venir; quedará null
      peg: num(r.pegRatio),
      pb: num(r.priceToBookRatio),
      ps: num(r.priceToSalesRatio),
      pfcf: num(r.priceToFreeCashFlowsRatio ?? r.priceToFreeCashFlowRatio),
      evEbitda: num(r.enterpriseValueMultiple),
      evSales: num(r.evToSales ?? r.enterpriseValueToSales),
      dividendYield: num(r.dividendYield) != null ? Number(r.dividendYield) * 100 : null,
      // campos de “contexto” que podrás poblar más adelante
      pePercentile5y: null as number | null,
      peZscorePeers: null as number | null,
      impliedGrowth: null as number | null,
      discountVsPt: null as number | null,
      rawRatios: r,
      rawGrowth: growth ?? [],
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Valuation build failed" }, { status: 500 });
  }
}
