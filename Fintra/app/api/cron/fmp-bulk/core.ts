import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchAllFmpData } from "./fetchBulk";
import { buildSnapshot, SNAPSHOT_ENGINE_VERSION } from "./buildSnapshots";
import { upsertSnapshots } from "./upsertSnapshots";
import { getActiveStockTickers } from "@/lib/repository/active-stocks";
import {
  fetchFinancialHistory,
  computeGrowthRows,
  fetchPerformanceHistory,
  fetchValuationHistory,
  fetchSectorPerformanceHistory,
} from "./fetchGrowthData";

export async function runFmpBulk(
  tickerParam?: string,
  limitParam?: number,
  batchSizeParam: number = 10,
) {
  const fmpKey = process.env.FMP_API_KEY!;

  if (!fmpKey) {
    throw new Error("Missing env vars");
  }
  const supabase = supabaseAdmin;

  const today = new Date().toISOString().slice(0, 10);
  const tStart = performance.now();

  try {
    console.log(`📌 Snapshot Engine Version: ${SNAPSHOT_ENGINE_VERSION}`);

    // ─────────────────────────────────────────
    // DISTRIBUTED LOCK (Prevent Race Conditions)
    // ─────────────────────────────────────────
    const { count: existingCount } = await supabase
      .from("fintra_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", today);

    const alreadyComplete = existingCount && existingCount >= 53000;

    // Acquire lock before checking/writing data
    const { withLock, getDailyLockName } = await import("@/lib/utils/dbLocks");
    const lockName = getDailyLockName("fmp-bulk");

    // If lock can't be acquired, another instance is running
    // BUT allow incremental processing if data is incomplete
    const acquired = await import("@/lib/utils/dbLocks").then((m) =>
      m.tryAcquireLock(lockName),
    );

    if (!acquired && !tickerParam && alreadyComplete) {
      console.log(
        `⏭️  Another instance is already processing AND data is complete. Skipping.`,
      );
      return { skipped: true, reason: "lock_held" };
    }

    if (!acquired && existingCount && existingCount < 53000) {
      console.log(
        `⚠️  Lock held but data incomplete (${existingCount} < 53K). Proceeding with incremental processing...`,
      );
    }

    try {
      // ─────────────────────────────────────────
      // CURSOR (Data-based Idempotency)
      // ─────────────────────────────────────────
      // Check if snapshots exist for today
      const hasDataToday = (existingCount || 0) > 0;
      let processedTickers: string[] = [];

      // If data exists today, load processed tickers to avoid re-processing
      if (hasDataToday && !tickerParam) {
        console.log(
          `ℹ️  Snapshots already exist for ${today} (count=${existingCount}). Loading processed tickers...`,
        );

        const { data: processedSnaps } = await supabase
          .from("fintra_snapshots")
          .select("ticker")
          .eq("snapshot_date", today);

        processedTickers = (processedSnaps || []).map((s: any) => s.ticker);
        console.log(
          `✅ Loaded ${processedTickers.length} already processed tickers`,
        );
      }

      // ─────────────────────────────────────────
      // FETCH BULKS
      // ─────────────────────────────────────────
      console.log("🚀 Starting Parallel Bulk Fetch...");
      const [profilesRes, ratiosRes, metricsRes, scoresRes] = await Promise.all(
        [
          fetchAllFmpData("profiles", fmpKey),
          fetchAllFmpData("ratios", fmpKey),
          fetchAllFmpData("metrics", fmpKey),
          fetchAllFmpData("scores", fmpKey),
        ],
      );

      // Check for critical failures (Profiles is critical)
      if (!profilesRes.ok)
        throw new Error(`Profiles Fetch Failed: ${profilesRes.error?.message}`);

      // Others are optional but good to have
      if (!ratiosRes.ok)
        console.warn(`Ratios Fetch Failed: ${ratiosRes.error?.message}`);
      if (!metricsRes.ok)
        console.warn(`Metrics Fetch Failed: ${metricsRes.error?.message}`);
      if (!scoresRes.ok)
        console.warn(`Scores Fetch Failed: ${scoresRes.error?.message}`);

      const bulk = {
        profiles: profilesRes.data,
        ratios: ratiosRes.data,
        metrics: metricsRes.data,
        scores: scoresRes.data,
      };
      console.log(
        `📥 Bulk Data Ready: Profiles=${bulk.profiles.length}, Ratios=${bulk.ratios.length}`,
      );

      // ─────────────────────────────────────────
      // UNIVERSO ACTIVO
      // ─────────────────────────────────────────
      // Using helper to ensure only active 'stock' types are processed
      let allActiveTickers = await getActiveStockTickers(supabase);

      // INCREMENTAL PROCESSING: Filter out already processed tickers
      if (processedTickers.length > 0 && !tickerParam) {
        const beforeFilter = allActiveTickers.length;
        allActiveTickers = allActiveTickers.filter(
          (t) => !processedTickers.includes(t),
        );
        console.log(
          `🔄 INCREMENTAL MODE: Filtering ${beforeFilter} tickers → ${allActiveTickers.length} remaining (${processedTickers.length} already processed)`,
        );

        if (allActiveTickers.length === 0) {
          console.log(
            `✅ All tickers already processed for ${today}. Nothing to do.`,
          );
          return {
            skipped: true,
            date: today,
            count: processedTickers.length,
            reason: "all_complete",
          };
        }
      }

      if (tickerParam) {
        console.log(
          `🧪 BULK TEST MODE — processing only ticker: ${tickerParam}`,
        );
        // Filter EXACT match
        if (allActiveTickers.includes(tickerParam)) {
          allActiveTickers = [tickerParam];
        } else {
          allActiveTickers = []; // Skip silently if not active/found
        }
      }

      if (!allActiveTickers.length) {
        throw new Error("No active stocks to process");
      }

      const tickers = limitParam
        ? allActiveTickers.slice(0, limitParam)
        : allActiveTickers;

      console.log(`🏗️ Building Snapshots for ${tickers.length} tickers...`);

      // Create lookup maps for O(1) access
      const profilesMap = new Map<string, any>(
        bulk.profiles.map((p: any) => [p.symbol, p]),
      );
      const ratiosMap = new Map<string, any>(
        bulk.ratios.map((r: any) => [r.symbol, r]),
      );
      const metricsMap = new Map<string, any>(
        bulk.metrics.map((m: any) => [m.symbol, m]),
      );
      const scoresMap = new Map<string, any>(
        bulk.scores.map((s: any) => [s.symbol, s]),
      );

      // BUILD SNAPSHOTS
      // Fetch Sector Performance (Global for the run)
      const sectorPerformanceMap =
        await fetchSectorPerformanceHistory(supabase);

      // FASE 1 OPTIMIZATION: Prefetch industry performance and universe data
      const { fetchIndustryPerformanceMap, fetchUniverseMap } =
        await import("./fetchGrowthData");
      const industryPerformanceMap =
        await fetchIndustryPerformanceMap(supabase);
      const universeMap = await fetchUniverseMap(supabase);
      console.log(
        `[PREFETCH] ✅ All reference data loaded (sectors, industries, universe)`,
      );

      // Map tickers to buildSnapshot calls
      const BATCH_SIZE = batchSizeParam; // Default 10, or user override
      const snapshots: any[] = [];
      let relativeReturnNonNullCount = 0;
      let strategicStateNonNullCount = 0;

      const logMemory = (label: string) => {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        console.log(`🧠 Memory [${label}]: ${Math.round(used * 100) / 100} MB`);
      };

      console.log(
        `🏗️ Building Snapshots for ${tickers.length} tickers in batches of ${BATCH_SIZE}...`,
      );
      logMemory("Start");

      for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
        const batchTickers = tickers.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);

        console.log(
          `Processing Batch ${batchIndex}/${totalBatches} (${batchTickers.length} items)...`,
        );

        // Fetch Financial History for Growth Calculation
        const historyMap = await fetchFinancialHistory(supabase, batchTickers);
        // Include SPY for benchmark comparison
        const performanceMap = await fetchPerformanceHistory(supabase, [
          ...batchTickers,
          "SPY",
        ]);
        const valuationMap = await fetchValuationHistory(
          supabase,
          batchTickers,
        );

        const benchmarkRows = performanceMap.get("SPY") || [];

        const batchPromises = batchTickers.map(async (ticker) => {
          const startTime = Date.now();

          try {
            console.log(
              `[${ticker}] [${new Date().toISOString()}] SNAPSHOT START`,
            );

            const profile = profilesMap.get(ticker) || null;
            const ratios = ratiosMap.get(ticker) || null;
            const metrics = metricsMap.get(ticker) || null;
            const scores = scoresMap.get(ticker) || null;

            // Log missing critical data
            if (!profile) {
              console.warn(
                `[${ticker}] [${new Date().toISOString()}] PROFILE MISSING`,
              );
            }
            if (profile && !profile.sector) {
              console.warn(
                `[${ticker}] [${new Date().toISOString()}] SECTOR MISSING`,
              );
            }

            // Compute Growth
            const history = historyMap.get(ticker) || [];
            const growthRows = computeGrowthRows(history);
            const performanceRows = performanceMap.get(ticker) || [];
            const valuationRows = valuationMap.get(ticker) || [];

            const snapshot = await buildSnapshot(
              ticker,
              profile,
              ratios,
              metrics,
              null, // quote (not available in bulk)
              null, // priceChange (not available in bulk)
              scores,
              growthRows, // incomeGrowthRows (computed from DB)
              growthRows, // cashflowGrowthRows (same, as fetchFinancialHistory gets both)
              history, // Full financial history for Moat
              performanceRows, // Performance history for Relative Return
              valuationRows, // Valuation history for Sentiment
              benchmarkRows, // Benchmark performance (SPY)
              sectorPerformanceMap, // Sector Performance for Relative Return
              industryPerformanceMap, // FASE 1: Industry Performance (prefetched)
              universeMap, // FASE 1: Universe Map (prefetched)
            );

            const duration = Date.now() - startTime;
            console.log(
              `[${ticker}] [${new Date().toISOString()}] SNAPSHOT OK (${duration}ms)`,
            );

            if (duration > 5000) {
              console.warn(
                `[${ticker}] [${new Date().toISOString()}] SLOW SNAPSHOT: ${duration}ms`,
              );
            }

            return snapshot;
          } catch (err: any) {
            const duration = Date.now() - startTime;
            console.error(
              `[${ticker}] [${new Date().toISOString()}] SNAPSHOT FAILED (${duration}ms):`,
              err.message,
            );
            // NO throw - continuar con siguiente ticker
            return null;
          }
        });

        // Wait for current batch to finish before starting next
        const batchResults = await Promise.all(batchPromises);
        const validSnapshots = batchResults.filter((s) => s !== null);

        for (const snap of validSnapshots) {
          if (
            snap.relative_return &&
            (snap.relative_return.score != null ||
              snap.relative_return.band != null)
          ) {
            relativeReturnNonNullCount += 1;
          }
          if (snap.strategic_state != null) {
            strategicStateNonNullCount += 1;
          }
        }

        snapshots.push(...validSnapshots);

        // FLUSH to DB every 200 snapshots to prevent timeout and memory overflow
        if (snapshots.length >= 200) {
          console.log(`💾 Flushing ${snapshots.length} snapshots to DB...`);
          await upsertSnapshots(supabase, snapshots);
          snapshots.length = 0; // Clear array
          if (global.gc) global.gc(); // Aggressive GC after flush
          logMemory("After Flush");
        }

        // Optional: Small breathing room for the event loop
        if (global.gc) {
          global.gc(); // Force GC if exposed
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
        logMemory(`End Batch ${batchIndex}`);
      }

      console.log(`💾 Upserting ${snapshots.length} snapshots...`);
      console.log(
        `📊 Hydration summary [${SNAPSHOT_ENGINE_VERSION}]: relative_return!=null=${relativeReturnNonNullCount}, strategic_state!=null=${strategicStateNonNullCount}`,
      );

      // UPSERT
      const result = await upsertSnapshots(supabase, snapshots);

      const tEnd = performance.now();
      const duration = ((tEnd - tStart) / 1000).toFixed(2);

      return {
        ok: true,
        processed: snapshots.length,
        duration_seconds: duration,
        result,
      };
    } catch (innerErr: any) {
      console.error("❌ Processing Error:", innerErr);
      throw innerErr;
    } finally {
      // Release lock
      if (!tickerParam) {
        const { releaseLock } = await import("@/lib/utils/dbLocks");
        await releaseLock(lockName);
      }
    }
  } catch (err: any) {
    console.error("❌ Bulk Cron Error:", err);
    throw err;
  }
}
