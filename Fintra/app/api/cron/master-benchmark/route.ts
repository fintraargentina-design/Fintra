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
export const maxDuration = 300; // 5 minutes (Vercel Limit)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitStr = searchParams.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 100;

  if (isNaN(limit) || limit <= 0) {
    return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
  }

  const startTime = Date.now();
  const steps: any[] = [];

  try {
    console.log(`🚀 [MasterBenchmark] Starting CANONICAL BULK BENCHMARK for ${limit} tickers...`);

    // ──────────────────────────────────────────────
    // FASE 0 — Universo
    // 1️⃣ sync-universe
    // ──────────────────────────────────────────────
    const t1 = Date.now();
    await runSyncUniverse(undefined, limit);
    steps.push({ step: '1. sync-universe', duration_ms: Date.now() - t1 });

    // ──────────────────────────────────────────────
    // FASE 1 — Precios
    // 2️⃣ prices-daily-bulk
    // ──────────────────────────────────────────────
    const t2 = Date.now();
    await runPricesDailyBulk({ limit });
    steps.push({ step: '2. prices-daily-bulk', duration_ms: Date.now() - t2 });

    // ──────────────────────────────────────────────
    // FASE 2 — Datos contables
    // 3️⃣ financials-bulk
    // ──────────────────────────────────────────────
    const t3 = Date.now();
    await runFinancialsBulk(undefined, limit);
    steps.push({ step: '3. financials-bulk', duration_ms: Date.now() - t3 });

    // ──────────────────────────────────────────────
    // FASE 3 — Snapshots core
    // 4️⃣ fmp-bulk
    // ──────────────────────────────────────────────
    const t4 = Date.now();
    // runFmpBulk accepts (ticker, limit)
    await runFmpBulk(undefined, limit);
    steps.push({ step: '4. fmp-bulk', duration_ms: Date.now() - t4 });

    // ──────────────────────────────────────────────
    // FASE 4 — Valuación
    // 5️⃣ valuation-bulk
    // ──────────────────────────────────────────────
    const t5 = Date.now();
    // debugMode: false (use CSVs, not API), limit passed
    await runValuationBulk({ limit, debugMode: false });
    steps.push({ step: '5. valuation-bulk', duration_ms: Date.now() - t5 });

    // ──────────────────────────────────────────────
    // FASE 5 — Benchmarks sectoriales
    // 6️⃣ sector-benchmarks
    // ──────────────────────────────────────────────
    const t6 = Date.now();
    // Sector benchmarks calculates percentiles based on DB data. 
    // Since we limited previous steps, the DB only has fresh data for those tickers (or mixed).
    // It doesn't strictly need a limit because it aggregates whatever is in DB.
    await runSectorBenchmarks(); 
    steps.push({ step: '6. sector-benchmarks', duration_ms: Date.now() - t6 });

    // ──────────────────────────────────────────────
    // FASE 6 — Performance
    // 7️⃣ performance-bulk
    // ──────────────────────────────────────────────
    const t7 = Date.now();
    await runPerformanceBulk(undefined, limit);
    steps.push({ step: '7. performance-bulk', duration_ms: Date.now() - t7 });

    // ──────────────────────────────────────────────
    // FASE 7 — UI Cache
    // 8️⃣ market-state-bulk
    // ──────────────────────────────────────────────
    const t8 = Date.now();
    await runMarketStateBulk(undefined, limit);
    steps.push({ step: '8. market-state-bulk', duration_ms: Date.now() - t8 });

    const totalDuration = Date.now() - startTime;
    const avgPerTicker = totalDuration / limit;

    return NextResponse.json({
      success: true,
      mode: 'BENCHMARK_BULK',
      limit: limit,
      total_duration_ms: totalDuration,
      avg_ms_per_ticker: avgPerTicker,
      estimated_full_market_min: (avgPerTicker * 45000) / 60000, // Naive linear projection
      steps
    });

  } catch (error: any) {
    console.error(`[MasterBenchmark] Failed:`, error);
    return NextResponse.json({
      success: false,
      error: error.message,
      steps_completed: steps
    }, { status: 500 });
  }
}
