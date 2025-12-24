// app/api/fmp/ratios/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Símbolo requerido")
    .regex(/^[A-Za-z0-9.\-\^]+$/, "Símbolo inválido")
    .transform((s) => s.toUpperCase()),
  period: z.enum(["annual","quarter","ttm","FY","Q1","Q2","Q3","Q4"]).default("annual"),
  limit: z.coerce.number().int().positive().max(40).default(5), // Default to 5 to get enough history for filtering
});

export const revalidate = 43200; // 12 horas en segundos

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      symbol: searchParams.get("symbol") ?? "",
      period: searchParams.get("period") ?? "annual",
      limit: searchParams.get("limit") ?? "5",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { symbol, period, limit } = parsed.data;
    let data: any = [];

    if (period === "ttm") {
      // TTM: /stable/ratios-ttm
      data = await fmpGet<any[]>(`/stable/ratios-ttm`, { symbol });
    } 
    else if (["Q1","Q2","Q3","Q4"].includes(period)) {
      // Specific quarter: fetch quarters and filter
      // Fetch more than needed to find the specific quarter
      const rawData = await fmpGet<any[]>(`/stable/ratios`, { 
        symbol, 
        period: "quarter", 
        limit: Math.max(limit, 8) // Ensure we have enough data to search
      });
      
      const want = period;
      const filtered = Array.isArray(rawData) ? rawData.filter((r: any) => {
        const d = String(r?.date || "");
        const m = Number(d.slice(5, 7));
        const q = m >= 1 && m <= 3 ? "Q1" : m <= 6 ? "Q2" : m <= 9 ? "Q3" : "Q4";
        return q === want;
      }) : [];
      
      data = filtered.slice(0, 1); // Original logic returned 1 item for Qx
    } 
    else if (period === "FY") {
      // FY: fetch annual limit 1
      data = await fmpGet<any[]>(`/stable/ratios`, { 
        symbol, 
        period: "annual", 
        limit: 1 
      });
    } 
    else {
      // Standard annual/quarter
      data = await fmpGet<any[]>(`/stable/ratios`, { 
        symbol, 
        period, 
        limit 
      });
    }

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/ratios] error:", err?.message || err);
    return NextResponse.json([], { 
      status: 200, 
      headers: { "X-Fallback": "true" } 
    });
  }
}
