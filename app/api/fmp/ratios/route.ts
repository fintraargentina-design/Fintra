// app/api/fmp/ratios/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";

const FMP_BASE_URL = process.env.FMP_BASE_URL ?? "https://financialmodelingprep.com/api";
const FMP_API_KEY = process.env.FMP_API_KEY!;

const QuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Símbolo requerido")
    .regex(/^[A-Za-z0-9.\-\^]+$/, "Símbolo inválido") // ← valida ANTES
    .transform((s) => s.toUpperCase()),               // ← transforma DESPUÉS
  period: z.enum(["annual","quarter","ttm","FY","Q1","Q2","Q3","Q4"]).default("annual"),
  limit: z.coerce.number().int().positive().max(40).default(1),
});

function buildUrl(path: string, params: Record<string, string | number>) {
  const url = new URL(`${FMP_BASE_URL}${path.startsWith("/api") ? path : `/api${path}`}`);
  Object.entries({ ...params, apikey: FMP_API_KEY }).forEach(([k, v]) =>
    url.searchParams.set(k, String(v)),
  );
  return url.toString();
}

export const revalidate = 43200; // 12 horas en segundos

export async function GET(req: Request) {
  if (!FMP_API_KEY) {
    return NextResponse.json({ error: "Missing FMP_API_KEY" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    symbol: searchParams.get("symbol") ?? "",
    period: searchParams.get("period") ?? "annual",
    limit: searchParams.get("limit") ?? "1",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { symbol, period, limit } = parsed.data;
let data: any = [];

if (period === "ttm") {
  const urlTTM = buildUrl(`/v3/ratios-ttm/${symbol}`, {});
  const resTTM = await fetch(urlTTM, { cache: "no-store" });
  if (!resTTM.ok) return NextResponse.json({ error: `FMP ${resTTM.status}` }, { status: resTTM.status });
  data = await resTTM.json();
} else if (["Q1","Q2","Q3","Q4"].includes(period as any)) {
  const urlQ = buildUrl(`/v3/ratios/${symbol}`, { period: "quarter", limit: 8 });
  const resQ = await fetch(urlQ, { cache: "no-store" });
  if (!resQ.ok) return NextResponse.json({ error: `FMP ${resQ.status}` }, { status: resQ.status });
  const arr = await resQ.json();
  const want = String(period);
  const filtered = Array.isArray(arr) ? arr.filter((r: any) => {
    const d = String(r?.date || "");
    const m = Number(d.slice(5, 7));
    const q = m >= 1 && m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
    return q === want;
  }) : [];
  data = filtered.slice(0, 1);
} else if (period === "FY") {
  const urlFY = buildUrl(`/v3/ratios/${symbol}`, { period: "annual", limit: 1 });
  const resFY = await fetch(urlFY, { cache: "no-store" });
  if (!resFY.ok) return NextResponse.json({ error: `FMP ${resFY.status}` }, { status: resFY.status });
  data = await resFY.json();
} else {
  const url = buildUrl(`/v3/ratios/${symbol}`, { period, limit });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: `FMP ${res.status}` }, { status: res.status });
  data = await res.json();
}
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600",
    },
  });
}
