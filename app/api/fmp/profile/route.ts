// /app/api/fmp/profile/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { fmpGet } from "@/lib/fmp/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeProfileStructural } from "@/app/api/cron/fmp-bulk/normalizeProfileStructural";
import { recomputeFGOSForTicker } from "../../../../lib/engine/fgos-recompute";

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

    // Persistencia y recomputación FGOS (single symbol)
    const today = new Date().toISOString().slice(0, 10);
    let summary: any = {
      ticker: symbol,
      profile_status: 'pending',
      sector: null,
      fgos_status: 'pending',
      fgos_score: null
    };

    // Si no hay datos, retorno estable sin error
    if (!data || data.length === 0) {
      return NextResponse.json(summary, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Solo aplicamos persistencia y recompute si es un único símbolo (no lista)
    if (!symbol.includes(',')) {
      const profile = data[0] || null;
      const sector = (profile?.sector ?? (profile as any)?.Sector ?? null) as string | null;

      // Normalizar y marcar perfil como "computed"
      const normalized = normalizeProfileStructural(
        profile,
        null,
        {},
        { source: 'on_demand', last_updated: new Date().toISOString() }
      );
      
      const profileStructural = {
        ...normalized,
        status: 'computed'
      };

      // Persistir snapshot mínimo con sector y profile_structural
      try {
        await supabaseAdmin
          .from('fintra_snapshots')
          .upsert({
            ticker: symbol,
            snapshot_date: today,
            engine_version: 'v2.0',
            sector: sector,
            profile_structural: profileStructural
          }, { onConflict: 'ticker,snapshot_date,engine_version' });
      } catch (persistErr) {
        console.warn('[/api/fmp/profile] Persist profile_structural failed:', persistErr);
      }

      summary.ticker = symbol;
      summary.profile_status = 'computed';
      summary.sector = sector;

      if (sector) {
        try {
          const res = await recomputeFGOSForTicker(symbol, today);
          summary.fgos_status = res.status || 'pending';
          summary.fgos_score = res.score ?? null;
        } catch (reErr) {
          console.warn('[/api/fmp/profile] FGOS recompute failed:', reErr);
        }
      } else {
        summary.fgos_status = 'pending';
      }
    }

    return NextResponse.json(summary, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=3600",
      },
    });
  } catch (err: any) {
    console.error("[/api/fmp/profile] error:", err?.message || err);
    // Shape estable para no romper el cliente
    return NextResponse.json({
      ticker: sp.get('symbol') ?? '',
      profile_status: 'pending',
      sector: null,
      fgos_status: 'pending',
      fgos_score: null
    }, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=600",
        "X-Fallback": "true",
      },
    });
  }
}
