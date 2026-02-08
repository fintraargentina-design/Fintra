/**
 * FMP Bulk Snapshots - Worker Process
 *
 * Receives a chunk of tickers and processes them sequentially.
 * Designed to run in parallel with other workers (Fase 2).
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildSnapshot } from "./buildSnapshots";
import { upsertSnapshots } from "./upsertSnapshots";
import {
  fetchFinancialHistory,
  fetchPerformanceHistory,
  fetchValuationHistory,
  fetchSectorPerformanceHistory,
} from "./fetchGrowthData";

// Shared prefetch data (passed from orchestrator)
interface SharedData {
  industryPerformanceMap: Map<string, Map<string, any>>;
  universeMap: Map<string, { sector: string; industry: string }>;
  allSectorPerformance: Map<string, any[]>;
  snapshotDate: string;
  // Bulk FMP data
  profilesMap: Map<string, any>;
  ratiosMap: Map<string, any>;
  metricsMap: Map<string, any>;
  scoresMap: Map<string, any>;
}

/**
 * Process a chunk of tickers (follows same pattern as core.ts)
 */
export async function processChunk(
  tickers: string[],
  sharedData: SharedData,
  workerId: number,
): Promise<{ processed: number; errors: string[] }> {
  const {
    industryPerformanceMap,
    universeMap,
    allSectorPerformance,
    snapshotDate,
    profilesMap,
    ratiosMap,
    metricsMap,
    scoresMap,
  } = sharedData;

  const errors: string[] = [];
  let processedCount = 0;

  console.log(
    `[Worker ${workerId}] 🚀 Starting chunk of ${tickers.length} tickers`,
  );

  const snapshots: any[] = [];
  const BATCH_SIZE = 200; // Process in sub-batches

  // Process in batches (sequential CPU work)
  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batchTickers = tickers.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(tickers.length / BATCH_SIZE);

    console.log(
      `[Worker ${workerId}] Processing Batch ${batchIndex}/${totalBatches} (${batchTickers.length} items)...`,
    );

    try {
      // Fetch historical data for batch
      const historyMap = await fetchFinancialHistory(
        supabaseAdmin,
        batchTickers,
      );
      const performanceMap = await fetchPerformanceHistory(supabaseAdmin, [
        ...batchTickers,
        "SPY",
      ]);
      const valuationMap = await fetchValuationHistory(
        supabaseAdmin,
        batchTickers,
      );
      const benchmarkRows = performanceMap.get("SPY") || [];

      // Process each ticker in batch
      for (const ticker of batchTickers) {
        try {
          const profile = profilesMap.get(ticker) || null;
          const ratios = ratiosMap.get(ticker) || null;
          const metrics = metricsMap.get(ticker) || null;
          const scores = scoresMap.get(ticker) || null;

          const incomeGrowthRows: any[] = [];
          const cashflowGrowthRows: any[] = [];
          const financialHistory = historyMap.get(ticker) || [];
          const performanceRows = performanceMap.get(ticker) || [];
          const valuationRows = valuationMap.get(ticker) || [];

          const snapshot = await buildSnapshot(
            ticker,
            profile,
            ratios,
            metrics,
            null, // quote
            null, // priceChange
            scores,
            incomeGrowthRows,
            cashflowGrowthRows,
            financialHistory,
            performanceRows,
            valuationRows,
            benchmarkRows,
            allSectorPerformance,
            industryPerformanceMap,
            universeMap,
          );

          snapshots.push(snapshot);
          processedCount++;
        } catch (error: any) {
          const errorMsg = `[${ticker}] ${error.message}`;
          errors.push(errorMsg);
          console.error(`[Worker ${workerId}] ❌`, errorMsg);
        }
      }

      // Flush after each batch (I/O-bound work)
      if (snapshots.length >= 200) {
        console.log(
          `[Worker ${workerId}] 💾 Flushing ${snapshots.length} snapshots to DB...`,
        );
        await upsertSnapshots(supabaseAdmin, snapshots);
        snapshots.length = 0;
      }
    } catch (error: any) {
      console.error(`[Worker ${workerId}] ❌ Batch error:`, error.message);
      errors.push(`Batch ${batchIndex}: ${error.message}`);
    }
  }

  // Flush remaining snapshots
  if (snapshots.length > 0) {
    console.log(
      `[Worker ${workerId}] 💾 Flushing final ${snapshots.length} snapshots to DB...`,
    );
    await upsertSnapshots(supabaseAdmin, snapshots);
  }

  console.log(
    `[Worker ${workerId}] ✅ Completed: ${processedCount} processed, ${errors.length} errors`,
  );

  return { processed: processedCount, errors };
}

/**
 * Worker entry point (can be called from spawn)
 */
if (require.main === module) {
  const { readFileSync } = require("fs");

  const args = process.argv.slice(2);
  const workerId = parseInt(args[0] || "0", 10);
  const tickersPath = args[1];
  const sharedDataPath = args[2];

  if (!tickersPath || !sharedDataPath) {
    console.error(
      "Usage: node worker.js <workerId> <tickersPath> <sharedDataPath>",
    );
    process.exit(1);
  }

  // Read tickers from file
  console.log(`[Worker ${workerId}] 📖 Reading tickers from ${tickersPath}`);
  const tickers = JSON.parse(readFileSync(tickersPath, "utf-8"));

  // Read shared data from file
  console.log(
    `[Worker ${workerId}] 📖 Reading shared data from ${sharedDataPath}`,
  );
  const sharedDataRaw = JSON.parse(readFileSync(sharedDataPath, "utf-8"));

  // Reconstruct Maps from JSON
  const sharedData: SharedData = {
    industryPerformanceMap: new Map(
      Object.entries(sharedDataRaw.industryPerformanceMap).map(([k, v]) => [
        k,
        new Map(Object.entries(v as any)),
      ]),
    ),
    universeMap: new Map(Object.entries(sharedDataRaw.universeMap)),
    allSectorPerformance: new Map(
      Object.entries(sharedDataRaw.allSectorPerformance),
    ),
    snapshotDate: sharedDataRaw.snapshotDate,
    profilesMap: new Map(Object.entries(sharedDataRaw.profilesMap)),
    ratiosMap: new Map(Object.entries(sharedDataRaw.ratiosMap)),
    metricsMap: new Map(Object.entries(sharedDataRaw.metricsMap)),
    scoresMap: new Map(Object.entries(sharedDataRaw.scoresMap)),
  };

  console.log(`[Worker ${workerId}] ✅ Shared data loaded`);

  processChunk(tickers, sharedData, workerId)
    .then(({ processed, errors }) => {
      console.log(
        `[Worker ${workerId}] 🏁 DONE: ${processed} processed, ${errors.length} errors`,
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error(`[Worker ${workerId}] 💥 FATAL:`, error);
      process.exit(1);
    });
}
