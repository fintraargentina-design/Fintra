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
  period: z.enum(["annual","quarter","ttm","FY","Q1","Q2","Q3","Q4"]).default("ttm"),
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
    period: sp.get("period") ?? "ttm",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { symbol, period } = parsed.data;

  try {
        // Ratios: soporte TTM, Q1–Q4 y FY
    let r: any = {};
    if (period === "ttm") {
      const ratiosTTM = await fmpGet<any>(`/api/v3/ratios-ttm/${symbol}`);
      r = Array.isArray(ratiosTTM) ? (ratiosTTM[0] ?? {}) : (ratiosTTM ?? {});
    } else if (["Q1","Q2","Q3","Q4"].includes(period as any)) {
      const raw = await fmpGet<any[]>(`/api/v3/ratios/${symbol}`, { limit: 8, period: "quarter" });
      const arr = Array.isArray(raw) ? raw : [];
      const want = String(period);
      const filtered = arr.filter((node) => {
        const d = String(node?.date || "");
        const m = Number(d.slice(5, 7));
        const q = m >= 1 && m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
        return q === want;
      });
      r = filtered.length ? filtered[0] : {};
    } else if (period === "FY") {
      // Usamos el último anual directo de FMP
      const raw = await fmpGet<any[]>(`/api/v3/ratios/${symbol}`, { limit: 1, period: "annual" });
      r = Array.isArray(raw) && raw.length ? raw[0] : {};
    } else {
      const ratios = await fmpGet<any[]>(`/api/v3/ratios/${symbol}`, { limit: 1, period });
      r = Array.isArray(ratios) && ratios.length ? ratios[0] : {};
    }// Growth (sin TTM en API): usa annual/quarter según periodo
    const growthPeriod = period === "ttm" ? "annual" : period;
    const growth = await fmpGet<any[]>(`/api/v3/financial-growth/${symbol}`, { period: growthPeriod, limit: 5 });

    // Nuevo: fallback de forward P/E usando crecimiento de EPS
    const peValue = num(r?.priceEarningsRatio ?? r?.priceEarningsRatioTTM ?? r?.peRatioTTM);
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
    const pegValue = num(r?.pegRatio ?? r?.priceToEarningsGrowthRatio ?? r?.priceEarningsToGrowthRatio ?? r?.pegRatioTTM ?? r?.priceEarningsToGrowthRatioTTM);
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
    const evSalesDirect = num(r?.evToSales ?? r?.enterpriseValueToSales ?? r?.evToSalesTTM);
    let evSalesFallback: number | null = null;
    if (evSalesDirect == null) {
      try {
        let keyMetrics: any[] = [];
        if (period === "ttm") {
             keyMetrics = await fmpGet<any[]>(`/api/v3/key-metrics-ttm/${symbol}`);
        } else {
             keyMetrics = await fmpGet<any[]>(`/api/v3/key-metrics/${symbol}`, { period, limit: 1 });
        }
        const km = Array.isArray(keyMetrics) && keyMetrics.length ? keyMetrics[0] : {};
        evSalesFallback = num(km?.evToSales ?? km?.enterpriseValueToSales ?? km?.evToSalesTTM);
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
      const pt = await fmpGet<any>("/stable/price-target-consensus", { symbol });
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
        const low  = num(node?.priceTargetLow  ?? node?.targetLow);
        if (high != null && low != null && high > 0 && low > 0) {
          targetAvg = +(((high + low) / 2)).toFixed(2);
        }
      }
    } catch (_) {
      targetAvg = null;
    }

    // NUEVO: fallback al endpoint v3 si consenso no trajo datos
    if (targetAvg == null) {
      try {
        const ptv3 = await fmpGet<any[]>(`/api/v3/price-target/${symbol}`);
        const node2 = Array.isArray(ptv3) && ptv3.length ? ptv3[0] : {};
        targetAvg = num(
          node2?.targetMean ??
          node2?.targetMedian ??
          node2?.targetAverage ??
          node2?.priceTargetAverage ??
          node2?.averagePriceTarget ??
          node2?.targetAvg
        );
        if (targetAvg == null) {
          const high2 = num(node2?.targetHigh);
          const low2  = num(node2?.targetLow);
          if (high2 != null && low2 != null && high2 > 0 && low2 > 0) {
            targetAvg = +(((high2 + low2) / 2)).toFixed(2);
          }
        }
      } catch (_) {
        // sin datos
      }
    }

    // NUEVO: fallback al endpoint v3 si consenso no trajo datos
    if (targetAvg == null) {
      try {
        const ptv3 = await fmpGet<any[]>(`/api/v3/price-target/${symbol}`);
        const node2 = Array.isArray(ptv3) && ptv3.length ? ptv3[0] : {};
        targetAvg = num(
          node2?.targetMean ??
          node2?.targetMedian ??
          node2?.targetAverage ??
          node2?.priceTargetAverage ??
          node2?.averagePriceTarget ??
          node2?.targetAvg
        );
        if (targetAvg == null) {
          const high2 = num(node2?.targetHigh);
          const low2 = num(node2?.targetLow);
          if (high2 != null && low2 != null && high2 > 0 && low2 > 0) {
            targetAvg = +(((high2 + low2) / 2)).toFixed(2);
          }
        }
      } catch (_) {
        // sin datos
      }
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
      pb: num(r?.priceToBookRatio ?? r?.priceToBookRatioTTM ?? r?.priceBookValueRatioTTM),
      ps: num(r?.priceToSalesRatio ?? r?.priceToSalesRatioTTM ?? r?.priceSalesRatioTTM),
      pfcf: num(r?.priceToFreeCashFlowsRatio ?? r?.priceToFreeCashFlowRatio ?? r?.priceToFreeCashFlowsRatioTTM ?? r?.priceToFreeCashFlowRatioTTM),
      evEbitda: num(r?.enterpriseValueMultiple ?? r?.enterpriseValueMultipleTTM),
      evSales: evSalesDirect ?? evSalesFallback,

      // dividendYield suele venir como fracción (0.0123 = 1.23%)
      dividendYield:
        num(r?.dividendYield ?? r?.dividendYieldTTM ?? r?.dividendYielTTM) !== null ? +(num(r?.dividendYield ?? r?.dividendYieldTTM ?? r?.dividendYielTTM)! * 100).toFixed(2) : null,

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
