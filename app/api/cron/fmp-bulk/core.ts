import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllFmpData } from './fetchBulk';
import { buildSnapshot, SNAPSHOT_ENGINE_VERSION } from './buildSnapshots';
import { upsertSnapshots } from './upsertSnapshots';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import { fetchFinancialHistory, computeGrowthRows, fetchPerformanceHistory, fetchValuationHistory, fetchSectorPerformanceHistory } from './fetchGrowthData';

export async function runFmpBulk(tickerParam?: string, limitParam?: number) {
  const fmpKey = process.env.FMP_API_KEY!;

  if (!fmpKey) {
    throw new Error('Missing env vars');
  }
  const supabase = supabaseAdmin;

  const today = new Date().toISOString().slice(0, 10);
  const tStart = performance.now();

  try {
    console.log(`📌 Snapshot Engine Version: ${SNAPSHOT_ENGINE_VERSION}`);
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
      return { skipped: true, date: today, count };
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
      throw new Error('No active stocks');
    }

    const tickers = limitParam
      ? allActiveTickers.slice(0, limitParam)
      : allActiveTickers;

    console.log(`🏗️ Building Snapshots for ${tickers.length} tickers...`);
    
    // Create lookup maps for O(1) access
    const profilesMap = new Map<string, any>(bulk.profiles.map((p: any) => [p.symbol, p]));
    const ratiosMap = new Map<string, any>(bulk.ratios.map((r: any) => [r.symbol, r]));
    const metricsMap = new Map<string, any>(bulk.metrics.map((m: any) => [m.symbol, m]));
    const scoresMap = new Map<string, any>(bulk.scores.map((s: any) => [s.symbol, s]));

    // BUILD SNAPSHOTS
    // Fetch Sector Performance (Global for the run)
    const sectorPerformanceMap = await fetchSectorPerformanceHistory(supabase);

    // Map tickers to buildSnapshot calls
    const BATCH_SIZE = 10; // Reduced to 10 to prevent Access Violation / Memory issues
    const snapshots: any[] = [];
    let relativeReturnNonNullCount = 0;
    let strategicStateNonNullCount = 0;

    console.log(`🏗️ Building Snapshots for ${tickers.length} tickers in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batchTickers = tickers.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);
        
        console.log(`Processing Batch ${batchIndex}/${totalBatches} (${batchTickers.length} items)...`);

        // Fetch Financial History for Growth Calculation
        const historyMap = await fetchFinancialHistory(supabase, batchTickers);
        // Include SPY for benchmark comparison
        const performanceMap = await fetchPerformanceHistory(supabase, [...batchTickers, 'SPY']);
        const valuationMap = await fetchValuationHistory(supabase, batchTickers);

        const benchmarkRows = performanceMap.get('SPY') || [];

        const batchPromises = batchTickers.map(async (ticker) => {
            try {
                const profile = profilesMap.get(ticker) || null;
                const ratios = ratiosMap.get(ticker) || null;
                const metrics = metricsMap.get(ticker) || null;
                const scores = scoresMap.get(ticker) || null;

                // Compute Growth
                const history = historyMap.get(ticker) || [];
                const growthRows = computeGrowthRows(history);
                const performanceRows = performanceMap.get(ticker) || [];
                const valuationRows = valuationMap.get(ticker) || [];

                return await buildSnapshot(
                    ticker,
                    profile,
                    ratios,
                    metrics,
                    null, // quote (not available in bulk)
                    null, // priceChange (not available in bulk)
                    scores,
                    growthRows, // incomeGrowthRows (computed from DB)
                    growthRows, // cashflowGrowthRows (same, as fetchFinancialHistory gets both)
                    history,    // Full financial history for Moat
                    performanceRows, // Performance history for Relative Return
                    valuationRows, // Valuation history for Sentiment
                    benchmarkRows, // Benchmark performance (SPY)
                    sectorPerformanceMap // Sector Performance for Relative Return
                );
            } catch (err: any) {
                console.error(`❌ CRITICAL ERROR building snapshot for ${ticker}:`, err.message);
                return null;
            }
        });

        // Wait for current batch to finish before starting next
        const batchResults = await Promise.all(batchPromises);
        const validSnapshots = batchResults.filter(s => s !== null);

        for (const snap of validSnapshots) {
          if (snap.relative_return && (snap.relative_return.score != null || snap.relative_return.band != null)) {
            relativeReturnNonNullCount += 1;
          }
          if (snap.strategic_state != null) {
            strategicStateNonNullCount += 1;
          }
        }

        snapshots.push(...validSnapshots);
        
        // FLUSH to DB every 500 snapshots to prevent memory overflow and data loss on stop
        if (snapshots.length >= 500) {
            console.log(`💾 Flushing ${snapshots.length} snapshots to DB...`);
            await upsertSnapshots(supabase, snapshots);
            snapshots.length = 0; // Clear array
        }
        
        // Optional: Small breathing room for the event loop
        if (global.gc) {
            global.gc(); // Force GC if exposed
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`💾 Upserting ${snapshots.length} snapshots...`);
    console.log(`📊 Hydration summary [${SNAPSHOT_ENGINE_VERSION}]: relative_return!=null=${relativeReturnNonNullCount}, strategic_state!=null=${strategicStateNonNullCount}`);
    
    // UPSERT
    const result = await upsertSnapshots(supabase, snapshots);

    const tEnd = performance.now();
    const duration = ((tEnd - tStart) / 1000).toFixed(2);

    return {
      ok: true,
      processed: snapshots.length,
      duration_seconds: duration,
      result
    };

  } catch (err: any) {
    console.error('❌ Bulk Cron Error:', err);
    throw err;
  }
}
