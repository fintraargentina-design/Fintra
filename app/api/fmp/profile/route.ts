// /app/api/fmp/profile/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validación de query eliminada (hacemos validación manual)

export const revalidate = 43200; // 12 horas en segundos

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  // Permitir comas en el símbolo para peticiones múltiples
  const rawSymbol = sp.get("symbol") ?? "";
  
  // Si el símbolo contiene comas, es una lista. Validamos que la lista sea segura.
  // El regex debe permitir letras, números, puntos, guiones, carets Y comas.
  // RELAXED REGEX: Allow spaces too, just in case.
  const isValid = /^[A-Z0-9.\-\^, ]+$/i.test(rawSymbol);

  if (!rawSymbol || !isValid) {
    console.error(`[/api/fmp/profile] Invalid symbol requested: "${rawSymbol}"`);
    return NextResponse.json(
      { error: `Símbolo inválido (manual check): ${rawSymbol}` },
      { status: 400 }
    );
  }

  const symbol = rawSymbol.toUpperCase();

  try {
    // FMP: /v3/profile/{symbol} (Preferred)
    // Supports batch requests (comma separated) and is the standard endpoint.
    let endpointPath = `/api/v3/profile/${symbol}`;
    const params: Record<string, string> = {};

    // If symbol has commas, it works the same way in v3
    if (symbol.includes(',')) {
       const cleanSymbol = symbol.split(',').map(s => s.trim()).filter(Boolean).join(',');
       endpointPath = `/api/v3/profile/${cleanSymbol}`;
    }

    let data: any[] = [];
    try {
        data = await fmpGet<any[]>(endpointPath, params);
    } catch (err) {
        console.warn(`[/api/fmp/profile] Primary endpoint ${endpointPath} failed:`, err);
        // data remains []
    }

    // Fallback to stable endpoint if v3 returns empty/error for single symbol
    if ((!data || data.length === 0) && !symbol.includes(',')) {
        console.warn(`[/api/fmp/profile] No data from v3 for ${symbol}, trying /stable/profile...`);
        try {
            data = await fmpGet<any[]>('/stable/profile', { symbol });
        } catch (fallbackErr) {
            console.error("[/api/fmp/profile] Fallback failed:", fallbackErr);
        }
    }

    // Si no hay datos, no cachear por largo plazo para evitar guardar errores/vacíos
    if (!data || data.length === 0) {
      return NextResponse.json([], {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0", 
        },
      });
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/profile] error:", err?.message || err);
    // Shape estable para no romper el cliente
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
        "X-Fallback": "true",
      },
    });
  }
}
