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

    // Nuevo: fallback de forward P/E usando crecimiento de EPS
    const peValue = num(r?.priceEarningsRatio);
    const epsGrowthRate =
      Array.isArray(growth) && growth.length
        ? num((growth[0] as any)?.epsGrowth ?? (growth[0] as any)?.epsgrowth)
        : null;
    const forwardPeFallback =
      peValue != null && epsGrowthRate != null && (1 + epsGrowthRate) > 0
        ? +((peValue as number) / (1 + (epsGrowthRate as number))).toFixed(2)
        : null;

    // Segundo fallback: consenso analistas (estimatedEPSNextYear)
    const forwardPeDirect = num(r?.forwardPE);
    let forwardPeAnalyst: number | null = null;
    // Cálculo de crecimiento implícito basado en PEG y forward P/E
    const pegValue = num(r?.pegRatio ?? r?.priceToEarningsGrowthRatio ?? r?.priceEarningsToGrowthRatio);
    const peForGrowth = (forwardPeDirect ?? forwardPeFallback ?? forwardPeAnalyst ?? peValue) ?? null;
    const impliedGrowthCalc =
      pegValue != null && pegValue > 0 && peForGrowth != null && peForGrowth > 0
        ? +((peForGrowth as number) / (pegValue as number)).toFixed(2) // %
        : (peForGrowth != null && peForGrowth > 0 ? +(peForGrowth as number).toFixed(2) : null); // asumiendo PEG≈1
    if (forwardPeDirect == null && forwardPeFallback == null) {
      try {
        const analysts = await fmpGet<any[]>(
          `/api/v3/analyst-estimates/${symbol}`,
          { period, limit: 1 }
        );
        const a = Array.isArray(analysts) && analysts.length ? analysts[0] : {};
        const estNextEPS =
          num(a?.estimatedEPSNextYear ?? a?.estimatedEpsNextYear ?? a?.estimateEPSNextYear);

        if (estNextEPS != null && estNextEPS > 0) {
          const prof = await fmpGet<any[]>(`/api/v3/profile/${symbol}`);
          const p = Array.isArray(prof) && prof.length ? num(prof[0]?.price) : null;
          forwardPeAnalyst = p != null && p > 0 ? +(p / estNextEPS).toFixed(2) : null;
        }
      } catch (_) {
        forwardPeAnalyst = null;
      }
    }

    // EV/Sales: directo desde ratios + fallback desde key-metrics
    const evSalesDirect = num(r?.evToSales ?? r?.enterpriseValueToSales);
    let evSalesFallback: number | null = null;
    if (evSalesDirect == null) {
      try {
        const keyMetrics = await fmpGet<any[]>(`/api/v3/key-metrics/${symbol}`, { period, limit: 1 });
        const km = Array.isArray(keyMetrics) && keyMetrics.length ? keyMetrics[0] : {};
        evSalesFallback = num(km?.evToSales ?? km?.enterpriseValueToSales);
      } catch (_) {
        evSalesFallback = null;
      }
    }

    // Nuevo: cálculo de "Descuento vs. PT" (precio objetivo analistas vs precio actual)
    let currentPrice: number | null = null;
    try {
      const prof = await fmpGet<any[]>(`/api/v3/profile/${symbol}`);
      currentPrice = Array.isArray(prof) && prof.length ? num(prof[0]?.price) : null;
    } catch (_) {
      currentPrice = null;
    }

    let targetAvg: number | null = null;
    try {
      const pt = await fmpGet<any>(`/stable/price-target-consensus/${symbol}`);
      const node = Array.isArray(pt) && pt.length ? pt[0] : (pt ?? {});
      targetAvg = num(
        node?.targetConsensus ??
      node?.priceTargetAverage ??
        node?.targetPriceAverage ??
        node?.targetMean ??
        node?.targetMedian ??
        node?.targetAvg ??
        node?.targetAverage ??
        node?.averagePriceTarget ??
        node?.consensusPriceTarget ??
        node?.analystTargetPrice ??
        node?.priceTarget
      );

      // Fallback: si existen High/Low, promediar
      if (targetAvg == null) {
        const high = num(node?.priceTargetHigh ?? node?.targetHigh);
        const low = num(node?.priceTargetLow ?? node?.targetLow);
        if (high != null && low != null && high > 0 && low > 0) {
          targetAvg = +(((high + low) / 2)).toFixed(2);
        }
      }
    } catch (_) {
      targetAvg = null;
    }

    const discountVsPtCalc = (
      currentPrice != null && currentPrice > 0 && targetAvg != null && targetAvg > 0
    ) ? +((((targetAvg as number) / (currentPrice as number)) - 1) * 100).toFixed(2) : null;

    const out: ValuationOut = {
      symbol,
      date: r?.date ?? null,

      pe: peValue,
      forwardPe: forwardPeDirect ?? forwardPeFallback ?? forwardPeAnalyst,
      peg: pegValue,
      pb: num(r?.priceToBookRatio),
      ps: num(r?.priceToSalesRatio),
      pfcf: num(r?.priceToFreeCashFlowsRatio ?? r?.priceToFreeCashFlowRatio),
      evEbitda: num(r?.enterpriseValueMultiple),
      evSales: evSalesDirect ?? evSalesFallback,

      // dividendYield suele venir como fracción (0.0123 = 1.23%)
      dividendYield:
        num(r?.dividendYield) !== null ? +(num(r?.dividendYield)! * 100).toFixed(2) : null,

      pePercentile5y: null,
      peZscorePeers: null,
      impliedGrowth: impliedGrowthCalc,
      discountVsPt: discountVsPtCalc,

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
