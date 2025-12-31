// app/api/fmp/dividends/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────
const QuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Símbolo requerido")
    .regex(/^[A-Z0-9.\-\^]+$/i, "Símbolo inválido") // ✅ regex ANTES de transform (y cambiar .pattern por .regex)
    .transform((s) => s.toUpperCase()),
});

// ─────────────────────────────────────────────
// Tipos mínimos
// ─────────────────────────────────────────────
type DivRow = {
  date: string; // ex-date
  dividend?: number;
  paymentDate?: string;
  declarationDate?: string;
};
type PriceRow = { date: string; close: number };
type DivPayload =
  | { symbol?: string; historical?: DivRow[] }
  | { historical?: DivRow[] }
  | DivRow[];
type PricePayload =
  | { symbol?: string; historical?: PriceRow[] }
  | { historical?: PriceRow[] }
  | PriceRow[];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function parseList<T extends { date: string }>(raw: any): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && Array.isArray(raw.historical)) return raw.historical as T[];
  return [];
}
const fmtYear = (d: string) => new Date(d).getFullYear();

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = QuerySchema.safeParse({ symbol: sp.get("symbol") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const symbol = parsed.data.symbol;

  // 10 años para cubrir histórico y CAGRs 5y/10y
  const to = new Date();
  const from = new Date(to.getFullYear() - 10, 0, 1).toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  try {
    // Fetch a FMP vía cliente servidor (inyecta API key y compone query)
    const [divsRaw, pricesRaw, ratiosRaw] = await Promise.all([
      fmpGet<DivPayload>(`/api/v3/historical-price-full/stock_dividend/${symbol}`, {
        from,
        to: toStr,
      }),
      fmpGet<PricePayload>(`/api/v3/historical-price-full/${symbol}`, {
        from,
        to: toStr,
      }),
      fmpGet<any[]>(`/api/v3/ratios/${symbol}`, { limit: 1 }),
    ]);

    // Normalización
    const divs = parseList<DivRow>(divsRaw)
      .filter((d) => d?.date && d?.dividend !== undefined && Number.isFinite(d.dividend))
      .sort((a, b) => a.date.localeCompare(b.date));

    const prices = parseList<PriceRow>(pricesRaw).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const latestClose =
      prices.length > 0 ? Number(prices[prices.length - 1].close) : undefined;

    // DPS por año
    const dpsByYearMap = new Map<number, number>();
    for (const d of divs) {
      const y = fmtYear(d.date);
      dpsByYearMap.set(y, (dpsByYearMap.get(y) ?? 0) + (d.dividend ?? 0));
    }
    const dpsByYear = Array.from(dpsByYearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, dps]) => ({ year, dps: +dps.toFixed(4) }));

    // TTM dividend (últimos 4 pagos)
    const last4 = divs.slice(-4);
    const ttmDividend = last4.reduce((a, b) => a + (b.dividend ?? 0), 0);
    const yieldTTM = latestClose
      ? +(100 * (ttmDividend / latestClose)).toFixed(2)
      : null;

    // Yield anual usando precio promedio anual
    const avgCloseByYear = new Map<number, number>();
    const bucket = new Map<number, { sum: number; n: number }>();
    for (const p of prices) {
      const y = fmtYear(p.date);
      const acc = bucket.get(y) ?? { sum: 0, n: 0 };
      acc.sum += Number(p.close);
      acc.n += 1;
      bucket.set(y, acc);
    }
    for (const [y, { sum, n }] of bucket) avgCloseByYear.set(y, sum / n);

    const yieldByYear = dpsByYear.map(({ year, dps }) => {
      const avg = avgCloseByYear.get(year);
      return { year, yield: avg ? +(100 * (dps / avg)).toFixed(2) : null };
    });

    // Ex-dates y payment dates (para calendario)
    const exDates = divs.map((d) => d.date);
    const payDates = divs
      .map((d) => d.paymentDate)
      .filter(Boolean) as string[];

    // Payouts desde ratios
    const ratios = Array.isArray(ratiosRaw) && ratiosRaw.length ? ratiosRaw[0] : {};
    const payoutEPS = Number.isFinite(ratios?.payoutRatio)
      ? +(100 * ratios.payoutRatio).toFixed(2)
      : Number.isFinite(ratios?.dividendPayoutRatio)
      ? +(100 * ratios.dividendPayoutRatio).toFixed(2)
      : null;

    // Payout sobre FCF (si hay datos por acción TTM)
    const payoutFCF =
      Number.isFinite(ratios?.freeCashFlowPerShareTTM) &&
      Number.isFinite(ratios?.dividendPerShareTTM)
        ? +(
            100 *
            (ratios.dividendPerShareTTM / ratios.freeCashFlowPerShareTTM)
          ).toFixed(2)
        : null;

    return NextResponse.json(
      {
        symbol,
        dpsByYear,
        yieldByYear,
        yieldTTM,
        exDates,
        payDates,
        payout: { eps: payoutEPS, fcf: payoutFCF },
        updatedAt: new Date().toISOString(),
        source: "fmp",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=900",
        },
      }
    );
  } catch (e: any) {
    // Devolvemos shape estable (UI no rompe)
    return NextResponse.json(
      {
        symbol,
        dpsByYear: [],
        yieldByYear: [],
        yieldTTM: null,
        exDates: [],
        payDates: [],
        payout: { eps: null, fcf: null },
        source: "fmp",
        error: e?.message ?? "error",
        updatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
