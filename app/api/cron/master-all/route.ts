import { NextResponse } from 'next/server';
import { runSyncUniverse } from '../sync-universe/core';
import { runPricesDailyBulk } from '../prices-daily-bulk/core';
import { runFinancialsBulk } from '../financials-bulk/core';
import { runFmpBulk } from '../fmp-bulk/core';
import { runValuationBulk } from '../valuation-bulk/core';
import { runSectorBenchmarks } from '../sector-benchmarks/core';
import { runPerformanceBulk } from '../performance-bulk/core';
import { runMarketStateBulk } from '../market-state-bulk/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max (Vercel Limit)

export async function GET(req: Request) {
  const startTime = Date.now();
  const steps: any[] = [];

  try {
    console.log('🚀 [MasterCronAll] Starting CANONICAL FULL MARKET update...');

    // ──────────────────────────────────────────────
    // FASE 0 — Universo (fundación lógica)
    // 1️⃣ sync-universe
    // ──────────────────────────────────────────────
    const t1 = Date.now();
    await runSyncUniverse();
    steps.push({ step: '1. sync-universe', duration_ms: Date.now() - t1 });
    console.log('✅ [MasterCronAll] 1. Sync Universe complete');

    // ──────────────────────────────────────────────
    // FASE 1 — Precios (fuente absoluta)
    // 2️⃣ prices-daily-bulk
    // ──────────────────────────────────────────────
    const t2 = Date.now();
    await runPricesDailyBulk({});
    steps.push({ step: '2. prices-daily-bulk', duration_ms: Date.now() - t2 });
    console.log('✅ [MasterCronAll] 2. Prices Daily complete');

    // ──────────────────────────────────────────────
    // FASE 2 — Datos contables
    // 3️⃣ financials-bulk
    // ──────────────────────────────────────────────
    const t3 = Date.now();
    await runFinancialsBulk();
    steps.push({ step: '3. financials-bulk', duration_ms: Date.now() - t3 });
    console.log('✅ [MasterCronAll] 3. Financials Bulk complete');

    // ──────────────────────────────────────────────
    // FASE 3 — Snapshots core
    // 4️⃣ fmp-bulk
    // ──────────────────────────────────────────────
    const t4 = Date.now();
    await runFmpBulk();
    steps.push({ step: '4. fmp-bulk (snapshots)', duration_ms: Date.now() - t4 });
    console.log('✅ [MasterCronAll] 4. FMP Bulk (Snapshots) complete');

    // ──────────────────────────────────────────────
    // FASE 4 — Valuación
    // 5️⃣ valuation-bulk
    // ──────────────────────────────────────────────
    const t5 = Date.now();
    await runValuationBulk({ debugMode: false });
    steps.push({ step: '5. valuation-bulk', duration_ms: Date.now() - t5 });
    console.log('✅ [MasterCronAll] 5. Valuation Bulk complete');

    // ──────────────────────────────────────────────
    // FASE 5 — Benchmarks sectoriales
    // 6️⃣ sector-benchmarks
    // ──────────────────────────────────────────────
    const t6 = Date.now();
    await runSectorBenchmarks();
    steps.push({ step: '6. sector-benchmarks', duration_ms: Date.now() - t6 });
    console.log('✅ [MasterCronAll] 6. Sector Benchmarks complete');

    // ──────────────────────────────────────────────
    // FASE 6 — Performance (derivada)
    // 7️⃣ performance-bulk
    // ──────────────────────────────────────────────
    const t7 = Date.now();
    await runPerformanceBulk();
    steps.push({ step: '7. performance-bulk', duration_ms: Date.now() - t7 });
    console.log('✅ [MasterCronAll] 7. Performance Bulk complete');

    // ──────────────────────────────────────────────
    // FASE 7 — UI Cache (final)
    // 8️⃣ market-state-bulk
    // ──────────────────────────────────────────────
    const t8 = Date.now();
    await runMarketStateBulk();
    steps.push({ step: '8. market-state-bulk', duration_ms: Date.now() - t8 });
    console.log('✅ [MasterCronAll] 8. Market State Bulk complete');

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      mode: 'FULL_MARKET_CANONICAL',
      total_duration_ms: totalDuration,
      steps
    });

  } catch (error: any) {
    console.error(`🔥 [MasterCronAll] Critical Failure:`, error);
    return NextResponse.json({
      success: false,
      error: error.message,
      steps_completed: steps
    }, { status: 500 });
  }
}
