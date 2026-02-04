// app/api/fmp/cashflow/route.ts
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Valida y tipa la query
const Query = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "symbol requerido")
    .transform((s) => s.toUpperCase()),
  period: z.enum(["annual", "quarter"]).default("annual"),
  limit: z.coerce.number().int().positive().max(120).default(8),
});

// (Opcional) tipo reducido y amigable
type CashflowItem = {
  date?: string;
  symbol?: string;
  operatingCashFlow?: number | null;
  capitalExpenditure?: number | null;
  freeCashFlow?: number | null;
};

export async function GET(req: NextRequest) {
  try {
    const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));

    // FMP correcto: cash-flow-statement
    // fmpGet compone la URL base + API key y arma el querystring con { period, limit }
    const json = await fmpGet<any[]>(
      `/api/v3/cash-flow-statement/${q.symbol}`,
      { period: q.period, limit: q.limit }
    );

    // Normalización mínima (orden y cálculo de FCF si falta)
    const rows = Array.isArray(json) ? json : [];
    const out: CashflowItem[] = rows.map((r) => {
      const ocf = Number.isFinite(+r.operatingCashFlow) ? +r.operatingCashFlow : null;
      const capex = Number.isFinite(+r.capitalExpenditure) ? +r.capitalExpenditure : null;
      const fcf =
        Number.isFinite(+r.freeCashFlow)
          ? +r.freeCashFlow
          : ocf != null && capex != null
          ? ocf - Math.abs(capex)
          : null;

      return {
        date: r.date ?? r.calendarYear ?? undefined,
        symbol: r.symbol ?? q.symbol,
        operatingCashFlow: ocf,
        capitalExpenditure: capex,
        freeCashFlow: fcf,
      };
    });

    return NextResponse.json(out, { status: 200 });
  } catch (err: any) {
    console.error("[/api/fmp/cashflow] error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message ?? "Cash-flow fetch failed" },
      { status: 500 }
    );
  }
}
