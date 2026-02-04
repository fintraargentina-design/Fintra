import { NextResponse } from "next/server";
import { runSyncUniverse } from "../sync-universe/core";
import { runPricesDailyBulk } from "../prices-daily-bulk/core";
import { runFinancialsBulk } from "../financials-bulk/core";
import { runFmpBulk } from "../fmp-bulk/core";
import { runValuationBulk } from "../valuation-bulk/core";
import { runSectorBenchmarks } from "../sector-benchmarks/core";
import { runPerformanceBulk } from "../performance-bulk/core";
import { runMarketStateBulk } from "../market-state-bulk/core";
import { runSectorPerformanceAggregator } from "../sector-performance-aggregator/core";
import { runPerformanceWindowsAggregator } from "../performance-windows-aggregator/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (Vercel Limit)

export async function GET(req: Request) {
  const startTime = Date.now();
  const steps: any[] = [];

  // Parse Query Params
  const { searchParams } = new URL(req.url);
  const limitStr = searchParams.get("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  if (limit) {
    console.log(`🧪 [MasterCronAll] Running in LIMIT MODE: ${limit} tickers`);
  }

  try {
    console.log("🚀 [MasterCronAll] Starting CANONICAL FULL MARKET update...");

    // ──────────────────────────────────────────────
    // FASE 0 — Universo (fundación lógica)
    // 1️⃣ sync-universe
    // ──────────────────────────────────────────────
    const t1 = Date.now();
    await runSyncUniverse();
    steps.push({ step: "1. sync-universe", duration_ms: Date.now() - t1 });
    console.log("✅ [MasterCronAll] 1. Sync Universe complete");

    // ──────────────────────────────────────────────
    // FASE 1 — Precios (fuente absoluta)
    // 2️⃣ prices-daily-bulk
    // ──────────────────────────────────────────────
    const t2 = Date.now();
    await runPricesDailyBulk({ limit });
    steps.push({ step: "2. prices-daily-bulk", duration_ms: Date.now() - t2 });
    console.log("✅ [MasterCronAll] 2. Prices Daily complete");

    // ──────────────────────────────────────────────
    // FASE 2 — Datos contables
    // 3️⃣ financials-bulk
    // ──────────────────────────────────────────────
    const t3 = Date.now();
    await runFinancialsBulk(undefined, limit);
    steps.push({ step: "3. financials-bulk", duration_ms: Date.now() - t3 });
    console.log("✅ [MasterCronAll] 3. Financials Bulk complete");

    // ──────────────────────────────────────────────
    // FASE 3.5 — Performance Raw
    // 4️⃣ performance-bulk
    // ──────────────────────────────────────────────
    const t3_5 = Date.now();
    await runPerformanceBulk(undefined, limit);
    steps.push({ step: "4. performance-bulk", duration_ms: Date.now() - t3_5 });
    console.log("✅ [MasterCronAll] 4. Performance Bulk complete");

    // ──────────────────────────────────────────────
    // FASE 4 — Sector Performance Aggregation
    // 5️⃣ sector-performance-aggregator
    // ──────────────────────────────────────────────
    const t4 = Date.now();
    await runSectorPerformanceAggregator();
    steps.push({
      step: "5. sector-performance-aggregator",
      duration_ms: Date.now() - t4,
    });
    console.log("✅ [MasterCronAll] 5. Sector Performance Aggregator complete");

    // ──────────────────────────────────────────────
    // FASE 4.5 — Performance Windows Aggregation
    // 5.5️⃣ performance-windows-aggregator
    // ──────────────────────────────────────────────
    const t4_5 = Date.now();
    await runPerformanceWindowsAggregator();
    steps.push({
      step: "5.5. performance-windows-aggregator",
      duration_ms: Date.now() - t4_5,
    });
    console.log(
      "✅ [MasterCronAll] 5.5. Performance Windows Aggregator complete",
    );

    // ──────────────────────────────────────────────
    // FASE 5 — Snapshots core
    // 6️⃣ fmp-bulk
    // ──────────────────────────────────────────────
    const t5 = Date.now();
    await runFmpBulk(undefined, limit);
    steps.push({
      step: "6. fmp-bulk (snapshots)",
      duration_ms: Date.now() - t5,
    });
    console.log("✅ [MasterCronAll] 6. FMP Bulk (Snapshots) complete");

    // ──────────────────────────────────────────────
    // FASE 6 — Valuación
    // 7️⃣ valuation-bulk
    // ──────────────────────────────────────────────
    const t6 = Date.now();
    await runValuationBulk({ debugMode: false, limit });
    steps.push({ step: "7. valuation-bulk", duration_ms: Date.now() - t6 });
    console.log("✅ [MasterCronAll] 7. Valuation Bulk complete");

    // ──────────────────────────────────────────────
    // FASE 7 — Benchmarks sectoriales
    // 8️⃣ sector-benchmarks
    // ──────────────────────────────────────────────
    const t7 = Date.now();
    await runSectorBenchmarks();
    steps.push({ step: "8. sector-benchmarks", duration_ms: Date.now() - t7 });
    console.log("✅ [MasterCronAll] 8. Sector Benchmarks complete");

    // ──────────────────────────────────────────────
    // FASE 8 — UI Cache (final)
    // 9️⃣ market-state-bulk
    // ──────────────────────────────────────────────
    const t8 = Date.now();
    await runMarketStateBulk(undefined, limit);
    steps.push({ step: "9. market-state-bulk", duration_ms: Date.now() - t8 });
    console.log("✅ [MasterCronAll] 9. Market State Bulk complete");

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: "FULL_MARKET_CANONICAL",
      total_duration_ms: totalDuration,
      steps,
    });
  } catch (error: any) {
    console.error(`🔥 [MasterCronAll] Critical Failure:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        steps_completed: steps,
      },
      { status: 500 },
    );
  }
}
