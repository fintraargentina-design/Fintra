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
    // FMP: /stable/profile?symbol={symbol}
    // NOTA: Para múltiples símbolos separados por coma, FMP prefiere el formato /v3/profile/AAPL,MSFT
    // El endpoint /stable/profile?symbol=A,B a veces falla o devuelve solo el primero.
    // Vamos a detectar si hay comas para usar el path v3 que soporta batch.
    let endpointPath = '/stable/profile';
    const params: Record<string, string> = { symbol };

    if (symbol.includes(',')) {
       // Eliminar espacios alrededor de comas
       const cleanSymbol = symbol.split(',').map(s => s.trim()).filter(Boolean).join(',');
       endpointPath = `/api/v3/profile/${cleanSymbol}`;
       // Al usar path param, no necesitamos query param symbol
       delete params.symbol;
    }

    const data = await fmpGet<any[]>(endpointPath, params);

    return NextResponse.json(data ?? [], {
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
