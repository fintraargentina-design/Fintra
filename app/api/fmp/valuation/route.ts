// /app/api/fmp/valuation/route.ts
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────
const Query = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Símbolo requerido")
    .regex(/^[A-Z0-9.\-\^]+$/i, "Símbolo inválido")
    .transform((s) => s.toUpperCase()),
  period: z.enum(["annual", "quarter"]).default("annual"),
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const num = (x: any): number | null =>
  x === null || x === undefined || x === "" || !Number.isFinite(+x) ? null : +x;

type ValuationOut = {
  symbol: string;
  date: string | null;

  // Múltiplos
  pe: number | null;
  forwardPe: number | null;
  peg: number | null;
  pb: number | null;
  ps: number | null;
  pfcf: number | null;
  evEbitda: number | null;
  evSales: number | null;
  dividendYield: number | null; // %

  // Campos de contexto / reservados para mejoras
  pePercentile5y: number | null;
  peZscorePeers: number | null;
  impliedGrowth: number | null;
  discountVsPt: number | null;

  // Raw (útiles para debug/UI avanzada)
  rawRatios?: any;
  rawGrowth?: any[];
  updatedAt: string;
  source: "fmp";
  error?: string;
};

const cacheHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600", // 12h
};

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const parsed = Query.safeParse({
    symbol: sp.get("symbol") ?? "",
    period: sp.get("period") ?? "annual",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { symbol, period } = parsed.data;

  try {
    // 1) ratios (último)
    const ratios = await fmpGet<any[]>(`/api/v3/ratios/${symbol}`, {
      limit: 1,
      period,
    });
    const r = Array.isArray(ratios) && ratios.length ? ratios[0] : {};

    // 2) growth (consistencia con el resto del proyecto)
    const growth = await fmpGet<any[]>(
      `/api/v3/financial-growth/${symbol}`,
      { period, limit: 5 }
    );

    const out: ValuationOut = {
      symbol,
      date: r?.date ?? null,

      pe: num(r?.priceEarningsRatio),
      forwardPe: num(r?.forwardPE),
      peg: num(r?.pegRatio),
      pb: num(r?.priceToBookRatio),
      ps: num(r?.priceToSalesRatio),
      pfcf: num(r?.priceToFreeCashFlowsRatio ?? r?.priceToFreeCashFlowRatio),
      evEbitda: num(r?.enterpriseValueMultiple),
      evSales: num(r?.evToSales ?? r?.enterpriseValueToSales),

      // dividendYield suele venir como fracción (0.0123 = 1.23%)
      dividendYield:
        num(r?.dividendYield) !== null ? +(num(r?.dividendYield)! * 100).toFixed(2) : null,

      pePercentile5y: null,
      peZscorePeers: null,
      impliedGrowth: null,
      discountVsPt: null,

      rawRatios: r ?? {},
      rawGrowth: Array.isArray(growth) ? growth : [],
      updatedAt: new Date().toISOString(),
      source: "fmp",
    };

    return NextResponse.json(out, { status: 200, headers: cacheHeaders });
  } catch (err: any) {
    console.error("[/api/fmp/valuation] error:", err?.message || err);

    // Shape estable para no romper la UI
    const fallback: ValuationOut = {
      symbol,
      date: null,
      pe: null,
      forwardPe: null,
      peg: null,
      pb: null,
      ps: null,
      pfcf: null,
      evEbitda: null,
      evSales: null,
      dividendYield: null,
      pePercentile5y: null,
      peZscorePeers: null,
      impliedGrowth: null,
      discountVsPt: null,
      rawRatios: {},
      rawGrowth: [],
      updatedAt: new Date().toISOString(),
      source: "fmp",
      error: err?.message ?? "Valuation build failed",
    };

    return NextResponse.json(fallback, {
      status: 200,
      headers: { ...cacheHeaders, "X-Fallback": "true" },
    });
  }
}
