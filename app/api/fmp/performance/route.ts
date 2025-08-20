// /app/api/fmp/performance/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60 * 60; // 1h

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────
type HistRow = { date: string; close: number };
type HistPayload =
  | { symbol?: string; historical?: HistRow[] }
  | { historical?: HistRow[] }
  | HistRow[];

type ReturnsKey = "1M" | "3M" | "YTD" | "1Y" | "3Y" | "5Y";
type PerformanceOut = {
  symbol: string;
  returns: Record<ReturnsKey, number | null>;
  vol1Y: number | null;     // volatilidad anualizada últimos ~252d (%)
  maxDD1Y: number | null;   // drawdown máx. últimos ~252d (% negativo)
  updatedAt: string;
  source: "fmp";
  error?: string;
};

// ─────────────────────────────────────────────
// Validación
// ─────────────────────────────────────────────
const QuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Símbolo requerido")
    .regex(/^[A-Z0-9.\-\^]+$/i, "Símbolo inválido") // ✅ regex ANTES de transform
    .transform((s) => s.toUpperCase()),
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function parseHistorical(raw: HistPayload): HistRow[] {
  if (Array.isArray(raw)) return raw as HistRow[];
  if (raw && Array.isArray((raw as any).historical)) return (raw as any).historical as HistRow[];
  return [];
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function pickOldest(h: HistRow[], fromISO: string): HistRow | null {
  if (!h.length) return null;
  const asc = [...h].sort((a, b) => a.date.localeCompare(b.date));
  const from = new Date(fromISO).getTime();
  for (const row of asc) {
    const t = new Date(row.date).getTime();
    if (t >= from) return row;
  }
  return asc[0] ?? null; // si no hay >= from, tomamos el más viejo
}

function pickLatest(h: HistRow[]): HistRow | null {
  if (!h.length) return null;
  return [...h].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

function pctReturn(oldPrice: number, newPrice: number): number | null {
  if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice <= 0) return null;
  return (newPrice / oldPrice - 1) * 100;
}

function annualizedVol1Y(h: HistRow[]): number | null {
  const asc = [...h].sort((a, b) => a.date.localeCompare(b.date));
  const last252 = asc.slice(-252);
  if (last252.length < 30) return null;
  const rets: number[] = [];
  for (let i = 1; i < last252.length; i++) {
    const r = last252[i].close / last252[i - 1].close - 1;
    if (Number.isFinite(r)) rets.push(r);
  }
  if (rets.length < 20) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const varDaily = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  return Math.sqrt(varDaily) * Math.sqrt(252) * 100;
}

function maxDrawdown1Y(h: HistRow[]): number | null {
  const asc = [...h].sort((a, b) => a.date.localeCompare(b.date));
  const last252 = asc.slice(-252);
  if (!last252.length) return null;
  let peak = last252[0].close;
  let mdd = 0;
  for (const row of last252) {
    peak = Math.max(peak, row.close);
    const dd = row.close / peak - 1;
    mdd = Math.min(mdd, dd);
  }
  return mdd * 100; // negativo
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = QuerySchema.safeParse({ symbol: sp.get("symbol") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const symbol = parsed.data.symbol;

  const today = new Date();
  const y = today.getFullYear();
  const ranges: Record<ReturnsKey, { from: string; to: string }> = {
    "1M": { from: fmt(new Date(today.getTime() - 32 * 86400000)), to: fmt(today) },
    "3M": { from: fmt(new Date(today.getTime() - 95 * 86400000)), to: fmt(today) },
    YTD: { from: `${y}-01-01`, to: fmt(today) },
    "1Y": { from: fmt(new Date(today.getTime() - 366 * 86400000)), to: fmt(today) },
    "3Y": { from: fmt(new Date(today.getTime() - 3 * 365 * 86400000 - 3 * 86400000)), to: fmt(today) },
    "5Y": { from: fmt(new Date(today.getTime() - 5 * 365 * 86400000 - 5 * 86400000)), to: fmt(today) },
  };

  try {
    // Traemos 5 años y reutilizamos para todos los cortes
    const raw = await fmpGet<HistPayload>(`/api/v3/historical-price-full/${symbol}`, {
      from: ranges["5Y"].from,
      to: ranges["5Y"].to,
    });

    const hist = parseHistorical(raw);

    // Respuesta base (shape estable)
    const base: PerformanceOut = {
      symbol,
      returns: { "1M": null, "3M": null, YTD: null, "1Y": null, "3Y": null, "5Y": null },
      vol1Y: null,
      maxDD1Y: null,
      updatedAt: new Date().toISOString(),
      source: "fmp",
    };

    if (!hist.length) {
      return NextResponse.json(base, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=900",
        },
      });
    }

    const latest = pickLatest(hist);
    const out = { ...base };

    if (latest) {
      (Object.keys(ranges) as ReturnsKey[]).forEach((k) => {
        const fromRow = pickOldest(hist, ranges[k].from);
        out.returns[k] = fromRow ? pctReturn(fromRow.close, latest.close) : null;
      });
    }

    out.vol1Y = annualizedVol1Y(hist);
    out.maxDD1Y = maxDrawdown1Y(hist);

    return NextResponse.json(out, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=900",
      },
    });
  } catch (e: any) {
    const fallback: PerformanceOut = {
      symbol,
      returns: { "1M": null, "3M": null, YTD: null, "1Y": null, "3Y": null, "5Y": null },
      vol1Y: null,
      maxDD1Y: null,
      updatedAt: new Date().toISOString(),
      source: "fmp",
      error: e?.message ?? "error",
    };
    return NextResponse.json(fallback, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
        "X-Fallback": "true",
      },
    });
  }
}
