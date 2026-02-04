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
export const maxDuration = 300; // 5 minutes

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker parameter is required' }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();
  const startTime = Date.now();
  const steps: any[] = [];

  try {
    console.log(`🚀 [MasterTicker] Starting CANONICAL SINGLE TICKER update for ${upperTicker}...`);

    // ──────────────────────────────────────────────
    // FASE 0 — Universo
    // 1️⃣ sync-universe
    // ──────────────────────────────────────────────
    const t1 = Date.now();
    await runSyncUniverse(upperTicker);
    steps.push({ step: '1. sync-universe', duration_ms: Date.now() - t1 });

    // ──────────────────────────────────────────────
    // FASE 1 — Precios
    // 2️⃣ prices-daily-bulk
    // ──────────────────────────────────────────────
    const t2 = Date.now();
    await runPricesDailyBulk({ ticker: upperTicker });
    steps.push({ step: '2. prices-daily-bulk', duration_ms: Date.now() - t2 });

    // ──────────────────────────────────────────────
    // FASE 2 — Datos contables
    // 3️⃣ financials-bulk
    // ──────────────────────────────────────────────
    const t3 = Date.now();
    // Warning: This may still trigger bulk download if cache is missing, but will filter for ticker
    await runFinancialsBulk(upperTicker);
    steps.push({ step: '3. financials-bulk', duration_ms: Date.now() - t3 });

    // ──────────────────────────────────────────────
    // FASE 3 — Snapshots core
    // 4️⃣ fmp-bulk
    // ──────────────────────────────────────────────
    const t4 = Date.now();
    await runFmpBulk(upperTicker);
    steps.push({ step: '4. fmp-bulk', duration_ms: Date.now() - t4 });

    // ──────────────────────────────────────────────
    // FASE 4 — Valuación
    // 5️⃣ valuation-bulk
    // ──────────────────────────────────────────────
    const t5 = Date.now();
    // debugMode: true allows API fetch for single ticker instead of CSV download
    await runValuationBulk({ targetTicker: upperTicker, debugMode: true });
    steps.push({ step: '5. valuation-bulk', duration_ms: Date.now() - t5 });

    // ──────────────────────────────────────────────
    // FASE 5 — Benchmarks sectoriales
    // 6️⃣ sector-benchmarks
    // ──────────────────────────────────────────────
    const t6 = Date.now();
    await runSectorBenchmarks(upperTicker);
    steps.push({ step: '6. sector-benchmarks', duration_ms: Date.now() - t6 });

    // ──────────────────────────────────────────────
    // FASE 6 — Performance
    // 7️⃣ performance-bulk
    // ──────────────────────────────────────────────
    const t7 = Date.now();
    await runPerformanceBulk(upperTicker);
    steps.push({ step: '7. performance-bulk', duration_ms: Date.now() - t7 });

    // ──────────────────────────────────────────────
    // FASE 7 — UI Cache
    // 8️⃣ market-state-bulk
    // ──────────────────────────────────────────────
    const t8 = Date.now();
    await runMarketStateBulk(upperTicker);
    steps.push({ step: '8. market-state-bulk', duration_ms: Date.now() - t8 });

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      ticker: upperTicker,
      mode: 'SINGLE_TICKER_CANONICAL',
      total_duration_ms: totalDuration,
      steps
    });

  } catch (error: any) {
    console.error(`[MasterTicker] Failed for ${upperTicker}:`, error);
    return NextResponse.json({
      success: false,
      ticker: upperTicker,
      error: error.message,
      steps_completed: steps
    }, { status: 500 });
  }
}
