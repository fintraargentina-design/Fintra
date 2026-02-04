/**
 * Endpoint Admin: Reprocesar Snapshots Históricos
 *
 * Reprocesa snapshots afectados por el bug de Solvency.
 * Requiere autenticación especial (ADMIN_SECRET).
 *
 * Uso:
 * POST /api/admin/reprocess-snapshots
 * Headers: Authorization: Bearer <ADMIN_SECRET>
 * Body: {
 *   ticker?: string,          // Opcional: reprocesar solo este ticker
 *   startDate?: string,        // Opcional: desde esta fecha (YYYY-MM-DD)
 *   endDate?: string,          // Opcional: hasta esta fecha
 *   dryRun?: boolean          // Default true: solo simular
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeFGOS } from "@/lib/engine/fgos-recompute";
import { getBenchmarksForSector } from "@/lib/engine/benchmarks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ReprocessRequest {
  ticker?: string;
  startDate?: string;
  endDate?: string;
  minSolvency?: number; // Filtrar por solvency score mínimo
  maxSolvency?: number; // Filtrar por solvency score máximo
  dryRun?: boolean;
  batchSize?: number;
}

export async function POST(request: NextRequest) {
  // Autenticación especial para endpoints admin
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid admin credentials" },
      { status: 401 },
    );
  }

  try {
    const body: ReprocessRequest = await request.json();
    const {
      ticker,
      startDate = "2024-01-01",
      endDate = new Date().toISOString().split("T")[0],
      minSolvency,
      maxSolvency,
      dryRun = true,
      batchSize = 100,
    } = body;

    console.log("🔄 Iniciando reprocesamiento de snapshots...");
    console.log(`   Ticker: ${ticker || "ALL"}`);
    console.log(`   Rango: ${startDate} - ${endDate}`);
    console.log(
      `   Solvency filter: ${minSolvency ? `>=${minSolvency}` : "none"}`,
    );
    console.log(`   Dry Run: ${dryRun}`);

    // 1. Obtener snapshots a reprocesar
    let query = supabaseAdmin
      .from("fintra_snapshots")
      .select("*")
      .gte("snapshot_date", startDate)
      .lte("snapshot_date", endDate)
      .not("fgos_components", "is", null);

    if (ticker) {
      query = query.eq("ticker", ticker);
    }

    const { data: snapshots, error } = await query.order("snapshot_date", {
      ascending: false,
    });

    if (error) {
      throw new Error(`Error fetching snapshots: ${error.message}`);
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({
        message: "No snapshots found to reprocess",
        filters: { ticker, startDate, endDate },
      });
    }

    console.log(`📊 Encontrados ${snapshots.length} snapshots para reprocesar`);

    // 2. Filtrar por solvency score si se especificó
    let potentiallyAffected = snapshots;

    if (minSolvency !== undefined || maxSolvency !== undefined) {
      potentiallyAffected = snapshots.filter((s) => {
        const solvency = s.fgos_components?.solvency;
        if (!solvency) return false;

        if (minSolvency !== undefined && solvency < minSolvency) return false;
        if (maxSolvency !== undefined && solvency > maxSolvency) return false;

        return true;
      });
    } else {
      // Por defecto: identificar afectados (solvency > 70)
      potentiallyAffected = snapshots.filter((s) => {
        const solvency = s.fgos_components?.solvency;
        return solvency && solvency > 70;
      });
    }

    console.log(`🔴 Potencialmente afectados: ${potentiallyAffected.length}`);

    if (dryRun) {
      // Modo simulación: solo reportar
      return NextResponse.json({
        dryRun: true,
        summary: {
          total: snapshots.length,
          potentiallyAffected: potentiallyAffected.length,
          dateRange: { startDate, endDate },
          ticker: ticker || "ALL",
        },
        sample: potentiallyAffected.slice(0, 10).map((s) => ({
          ticker: s.ticker,
          date: s.snapshot_date,
          oldSolvency: s.fgos_components?.solvency,
          oldFgos: s.fgos_score,
        })),
        message: "Dry run completed. Set dryRun=false to execute reprocessing.",
      });
    }

    // 3. Reprocesar (modo real)
    const results = [];
    const batchPromises = [];

    for (let i = 0; i < potentiallyAffected.length; i += batchSize) {
      const batch = potentiallyAffected.slice(i, i + batchSize);

      const batchPromise = Promise.all(
        batch.map(async (snapshot) => {
          try {
            // Obtener datos necesarios para recompute
            const { data: financials } = await supabaseAdmin
              .from("datos_financieros")
              .select("*")
              .eq("ticker", snapshot.ticker)
              .eq("period_type", "FY")
              .order("period_end_date", { ascending: false })
              .limit(1)
              .single();

            if (!financials) {
              return {
                ticker: snapshot.ticker,
                status: "skipped",
                reason: "no_financials",
              };
            }

            const { data: ratios } = await supabaseAdmin
              .from("datos_financieros")
              .select("*")
              .eq("ticker", snapshot.ticker)
              .limit(1)
              .single();

            const today = new Date().toISOString().slice(0, 10);
            const benchmarks = await getBenchmarksForSector(
              snapshot.sector,
              today,
            );

            // Recomputar FGOS
            const growth = {
              revenue_cagr: financials.revenue_cagr,
              earnings_cagr: financials.earnings_cagr,
              fcf_cagr: financials.fcf_cagr,
            };

            const newFgos = computeFGOS(
              snapshot.ticker,
              snapshot as any,
              ratios as any,
              financials as any,
              growth,
              benchmarks as any,
              null,
            );

            // Actualizar snapshot
            const { error: updateError } = await supabaseAdmin
              .from("fintra_snapshots")
              .update({
                fgos_score: newFgos.fgos_score,
                fgos_category: newFgos.fgos_category,
                fgos_components: newFgos.fgos_components,
                fgos_confidence_percent: newFgos.fgos_confidence_percent,
                fgos_confidence_label: newFgos.fgos_confidence_label,
                updated_at: new Date().toISOString(),
              })
              .eq("id", snapshot.id);

            if (updateError) {
              return {
                ticker: snapshot.ticker,
                status: "error",
                error: updateError.message,
              };
            }

            return {
              ticker: snapshot.ticker,
              status: "updated",
              oldSolvency: snapshot.fgos_components?.solvency,
              newSolvency: newFgos.fgos_components?.solvency,
              oldFgos: snapshot.fgos_score,
              newFgos: newFgos.fgos_score,
            };
          } catch (err: any) {
            return {
              ticker: snapshot.ticker,
              status: "error",
              error: err.message,
            };
          }
        }),
      );

      batchPromises.push(batchPromise);
    }

    const batchResults = await Promise.all(batchPromises);
    const allResults = batchResults.flat();

    const summary = {
      total: potentiallyAffected.length,
      updated: allResults.filter((r) => r.status === "updated").length,
      errors: allResults.filter((r) => r.status === "error").length,
      skipped: allResults.filter((r) => r.status === "skipped").length,
    };

    console.log("✅ Reprocesamiento completado");
    console.log(`   Actualizados: ${summary.updated}`);
    console.log(`   Errores: ${summary.errors}`);

    return NextResponse.json({
      success: true,
      summary,
      results: allResults.slice(0, 50), // Primeros 50 resultados
      message: `Reprocessed ${summary.updated} snapshots successfully`,
    });
  } catch (err: any) {
    console.error("❌ Error en reprocesamiento:", err);
    return NextResponse.json(
      { error: "Reprocessing failed", message: err.message },
      { status: 500 },
    );
  }
}
