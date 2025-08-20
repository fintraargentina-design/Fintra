// app/api/fmp/scores/route.ts
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "symbol requerido")
    .transform((s) => s.toUpperCase())
    .regex(/^[A-Z0-9.\-\^]+$/, "símbolo inválido"),
});

type ScoresOut = {
  symbol: string;
  date?: string;
  altmanZ: number | null;
  piotroski: number | null;
  raw?: any; // opcional: payload original por si la UI lo usa
};

const num = (x: any): number | null =>
  Number.isFinite(+x) ? +x : null;

export async function GET(req: NextRequest) {
  try {
    const q = Query.parse(Object.fromEntries(new URL(req.url).searchParams));

    // FMP stable: financial-scores
    // Doc: https://financialmodelingprep.com/stable/financial-scores?symbol=AAPL
    const json = await fmpGet<Record<string, any>>(`/stable/financial-scores`, { symbol: q.symbol });

    // Soportar array u objeto
    const row = Array.isArray(json) ? json[0] : json ?? {};

    const out: ScoresOut = {
      symbol: q.symbol,
      date: row?.date ?? row?.period ?? row?.reportedDate ?? undefined,
      altmanZ: num(row?.altmanZScore ?? row?.altman_z_score),
      piotroski: num(row?.piotroskiScore ?? row?.piotroski_score),
      raw: row, // útil para depurar o ampliar luego en el cliente
    };

    return NextResponse.json(out, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=900",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/scores] error:", err?.message || err);
    // Shape estable para no romper UI
    const fallback: ScoresOut = {
      symbol: "",
      altmanZ: null,
      piotroski: null,
    };
    return NextResponse.json(fallback, { status: 200 });
  }
}
