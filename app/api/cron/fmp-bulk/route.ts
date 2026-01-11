// Fintra/app/api/cron/fmp-bulk/route.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { fetchAllFmpData } from './fetchBulk';
import { buildSnapshot } from './buildSnapshots';
import { upsertSnapshots } from './upsertSnapshots';
import { resolveValuationFromSector } from '@/lib/engine/resolveValuationFromSector';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import type { ValuationResult } from '@/lib/engine/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_NAME = 'fmp_bulk_snapshots';
const MIN_COVERAGE = 0.7;
const DEBUG_TICKER = 'AAPL';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const tickerParam = searchParams.get('ticker'); // Override param

  const fmpKey = process.env.FMP_API_KEY!;

  if (!fmpKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }
  const supabase = supabaseAdmin;

  const today = new Date().toISOString().slice(0, 10);
  const tStart = performance.now();

  try {
    // ─────────────────────────────────────────
    // CURSOR (Data-based Idempotency)
    // ─────────────────────────────────────────
    // Check if snapshots exist for today
    const { count } = await supabase
      .from('fintra_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('snapshot_date', today);

    const hasDataToday = (count || 0) > 0;

    // Bypass check if we are in test mode (ticker override)
    if (hasDataToday && !tickerParam) {
      console.log(`✅ Snapshots already exist for ${today} (count=${count}). Skipping.`);
      return NextResponse.json({ skipped: true, date: today, count });
    }

    // ─────────────────────────────────────────
    // FETCH BULKS
    // ─────────────────────────────────────────
    console.log('🚀 Starting Parallel Bulk Fetch...');
    const [profilesRes, ratiosRes, metricsRes, scoresRes] = await Promise.all([
        fetchAllFmpData('profiles', fmpKey),
        fetchAllFmpData('ratios', fmpKey),
        fetchAllFmpData('metrics', fmpKey),
        fetchAllFmpData('scores', fmpKey)
    ]);

    // Check for critical failures (Profiles is critical)
    if (!profilesRes.ok) throw new Error(`Profiles Fetch Failed: ${profilesRes.error?.message}`);
    
    // Others are optional but good to have
    if (!ratiosRes.ok) console.warn(`Ratios Fetch Failed: ${ratiosRes.error?.message}`);
    if (!metricsRes.ok) console.warn(`Metrics Fetch Failed: ${metricsRes.error?.message}`);
    if (!scoresRes.ok) console.warn(`Scores Fetch Failed: ${scoresRes.error?.message}`);

    const bulk = {
        profiles: profilesRes.data,
        ratios: ratiosRes.data,
        metrics: metricsRes.data,
        scores: scoresRes.data
    };
    console.log(`📥 Bulk Data Ready: Profiles=${bulk.profiles.length}, Ratios=${bulk.ratios.length}`);

    // ─────────────────────────────────────────
    // UNIVERSO ACTIVO
    // ─────────────────────────────────────────
    // Using helper to ensure only active 'stock' types are processed
    let allActiveTickers = await getActiveStockTickers(supabase);

    if (tickerParam) {
      console.log(`🧪 BULK TEST MODE — processing only ticker: ${tickerParam}`);
      // Filter EXACT match
      if (allActiveTickers.includes(tickerParam)) {
        allActiveTickers = [tickerParam];
      } else {
        allActiveTickers = []; // Skip silently if not active/found
      }
    }

    if (!allActiveTickers.length) {
      return NextResponse.json({ error: 'No active stocks' }, { status: 500 });
    }

    const tickers = limitParam
      ? allActiveTickers.slice(0, parseInt(limitParam))
      : allActiveTickers;

    console.log(`🏗️ Building Snapshots for ${tickers.length} tickers...`);
    
    // Create lookup maps for O(1) access
    const profilesMap = new Map<string, any>(bulk.profiles.map((p: any) => [p.symbol, p]));
    const ratiosMap = new Map<string, any>(bulk.ratios.map((r: any) => [r.symbol, r]));
    const metricsMap = new Map<string, any>(bulk.metrics.map((m: any) => [m.symbol, m]));
    const scoresMap = new Map<string, any>(bulk.scores.map((s: any) => [s.symbol, s]));

    // BUILD SNAPSHOTS
    // Map tickers to buildSnapshot calls
    const BATCH_SIZE = 10; // Reduced to 10 to prevent Access Violation / Memory issues
    const snapshots: any[] = [];

    console.log(`🏗️ Building Snapshots for ${tickers.length} tickers in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batchTickers = tickers.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
        
        console.log(`Processing Batch ${batchIndex}/${totalBatches} (${batchTickers.length} items)...`);

        const batchPromises = batchTickers.map(async (ticker) => {
            try {
                const profile = profilesMap.get(ticker) || null;
                const ratios = ratiosMap.get(ticker) || null;
                const metrics = metricsMap.get(ticker) || null;
                const scores = scoresMap.get(ticker) || null;

                return await buildSnapshot(
                    ticker,
                    profile,
                    ratios,
                    metrics,
                    null, // quote (not available in bulk)
                    null, // priceChange (not available in bulk)
                    scores,
                    [], // incomeGrowthRows (handled by separate cron)
                    []  // cashflowGrowthRows
                );
            } catch (err: any) {
                console.error(`❌ CRITICAL ERROR building snapshot for ${ticker}:`, err.message);
                return null;
            }
        });

        // Wait for current batch to finish before starting next
        const batchResults = await Promise.all(batchPromises);
        snapshots.push(...batchResults.filter(s => s !== null));
        
        // Optional: Small breathing room for the event loop
        if (global.gc) {
            global.gc(); // Force GC if exposed
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`💾 Upserting ${snapshots.length} snapshots...`);
    
    // UPSERT
    const result = await upsertSnapshots(supabase, snapshots);

    const tEnd = performance.now();
    const duration = ((tEnd - tStart) / 1000).toFixed(2);

    return NextResponse.json({
      ok: true,
      processed: snapshots.length,
      duration_seconds: duration,
      result
    });

  } catch (err: any) {
    console.error('❌ Bulk Cron Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
