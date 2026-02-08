/**
 * FMP Bulk Snapshots - FASE 2: Paralelización con Worker Pool
 *
 * Divide los 53K tickers en chunks y procesa en paralelo con 3-4 workers.
 * Objetivo: Reducir tiempo de ~6.7h → ~1.5-2h
 *
 * CRITICAL RULES:
 * - CPU work (processing): Sequential dentro de cada worker
 * - I/O work (DB writes): Parallel entre workers
 * - Prefetch compartido: 1 sola vez al inicio
 * - Fault tolerance: Error en 1 worker NO detiene otros
 */

import { spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  fetchIndustryPerformanceMap,
  fetchUniverseMap,
  fetchSectorPerformanceHistory,
} from "@/app/api/cron/fmp-bulk/fetchGrowthData";
import { fetchAllFmpData } from "@/app/api/cron/fmp-bulk/fetchBulk";
import {
  tryAcquireLock,
  releaseLock,
  getDailyLockName,
} from "@/lib/utils/dbLocks";

const NUM_WORKERS = 4; // Paralelismo (ajustar según CPU/red)
const SNAPSHOT_DATE = new Date().toISOString().split("T")[0];
const FMP_KEY = process.env.FMP_API_KEY || "";

/**
 * Get active tickers excluding already processed
 */
async function getTickersToProcess(): Promise<string[]> {
  console.log("📊 Loading active tickers from fintra_active_stocks...");

  // Load ALL active tickers with pagination
  const allTickers: string[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: activeStocks, error } = await supabaseAdmin
      .from("fintra_active_stocks")
      .select("ticker")
      .order("ticker", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load active stocks: ${error.message}`);
    }

    if (!activeStocks || activeStocks.length === 0) break;

    allTickers.push(...activeStocks.map((s) => s.ticker));

    if (activeStocks.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`✅ Loaded ${allTickers.length} active tickers`);

  // Load already processed (with pagination fix)
  console.log("🔍 Loading already processed tickers...");
  const processedTickers: string[] = [];
  page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: processedSnaps } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker")
      .eq("snapshot_date", SNAPSHOT_DATE)
      .range(from, to);

    if (!processedSnaps || processedSnaps.length === 0) break;

    processedTickers.push(...processedSnaps.map((s: any) => s.ticker));

    if (processedSnaps.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`✅ Loaded ${processedTickers.length} already processed tickers`);

  // Filter
  const tickersToProcess = allTickers.filter(
    (t) => !processedTickers.includes(t),
  );

  console.log(
    `🔄 INCREMENTAL MODE: ${allTickers.length} → ${tickersToProcess.length} remaining`,
  );

  return tickersToProcess;
}

/**
 * Divide tickers en N chunks balanceados
 */
function chunkArray<T>(array: T[], numChunks: number): T[][] {
  const chunks: T[][] = Array.from({ length: numChunks }, () => []);
  array.forEach((item, index) => {
    chunks[index % numChunks].push(item);
  });
  return chunks;
}

/**
 * Run worker process
 */
function runWorker(
  workerId: number,
  tickers: string[],
  sharedDataPath: string,
): Promise<{ processed: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    const workerScript = "app/api/cron/fmp-bulk/worker.ts";

    // Write tickers to temp file to avoid shell escaping issues
    const tickersPath = join(
      process.cwd(),
      "data",
      `worker-${workerId}-tickers.json`,
    );
    writeFileSync(tickersPath, JSON.stringify(tickers));

    const args = [workerId.toString(), tickersPath, sharedDataPath];

    console.log(
      `[Worker ${workerId}] 🚀 Spawning with ${tickers.length} tickers`,
    );

    // Windows compatibility: use npx.cmd or shell
    const isWindows = process.platform === "win32";
    const npxCommand = isWindows ? "npx.cmd" : "npx";

    const child = spawn(npxCommand, ["tsx", workerScript, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const line = data.toString();
      stdout += line;
      process.stdout.write(`[W${workerId}] ${line}`);
    });

    child.stderr.on("data", (data) => {
      const line = data.toString();
      stderr += line;
      process.stderr.write(`[W${workerId}] ${line}`);
    });

    child.on("close", (code) => {
      if (code === 0) {
        // Parse result from stdout (simple approach)
        const processed = tickers.length; // Assume all processed if exit 0
        resolve({ processed, errors: [] });
      } else {
        reject(new Error(`Worker ${workerId} exited with code ${code}`));
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Main orchestrator
 */
async function main() {
  const startTime = Date.now();

  console.log("🎯 FMP BULK SNAPSHOTS - FASE 2: PARALELIZACIÓN");
  console.log(`📅 Snapshot Date: ${SNAPSHOT_DATE}`);
  console.log(`🔧 Workers: ${NUM_WORKERS}\n`);

  // 1. Advisory lock
  const lockName = getDailyLockName("fmp-bulk-parallel");
  console.log(`🔒 Acquiring advisory lock: ${lockName}`);

  const acquired = await tryAcquireLock(lockName);
  if (!acquired) {
    console.log("⚠️ Lock already held. Checking if we should proceed...");

    // Check if data is incomplete
    const { count: existingCount } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", SNAPSHOT_DATE);

    const alreadyComplete = existingCount && existingCount >= 53364; // Exact target

    if (alreadyComplete) {
      console.log("✅ Processing already complete. Exiting.");
      process.exit(0);
    }

    console.log("⚠️ Lock held but data incomplete. Proceeding anyway...");
  }

  try {
    // 2. Get tickers to process
    const tickers = await getTickersToProcess();

    if (tickers.length === 0) {
      console.log("✅ No tickers to process. All done!");
      return;
    }

    // 3. Prefetch shared data (ONCE)
    console.log("\n🔄 Prefetching shared data...");
    const [industryPerformanceMap, universeMap, allSectorPerformance] =
      await Promise.all([
        fetchIndustryPerformanceMap(supabaseAdmin),
        fetchUniverseMap(supabaseAdmin),
        fetchSectorPerformanceHistory(supabaseAdmin, new Date()),
      ]);

    console.log("✅ Database prefetch complete");

    // Fetch FMP Bulk Data (profiles, ratios, metrics, scores)
    console.log("🚀 Fetching FMP Bulk Data...");
    const [profilesRes, ratiosRes, metricsRes, scoresRes] = await Promise.all([
      fetchAllFmpData("profiles", FMP_KEY),
      fetchAllFmpData("ratios", FMP_KEY),
      fetchAllFmpData("metrics", FMP_KEY),
      fetchAllFmpData("scores", FMP_KEY),
    ]);

    if (!profilesRes.ok) {
      throw new Error(`Profiles Fetch Failed: ${profilesRes.error?.message}`);
    }

    // Create Maps
    const profilesMap = new Map<string, any>(
      profilesRes.data.map((p: any) => [p.symbol, p]),
    );
    const ratiosMap = new Map<string, any>(
      ratiosRes.ok ? ratiosRes.data.map((r: any) => [r.symbol, r]) : [],
    );
    const metricsMap = new Map<string, any>(
      metricsRes.ok ? metricsRes.data.map((m: any) => [m.symbol, m]) : [],
    );
    const scoresMap = new Map<string, any>(
      scoresRes.ok ? scoresRes.data.map((s: any) => [s.symbol, s]) : [],
    );

    console.log(
      `✅ FMP data loaded: ${profilesMap.size} profiles, ${ratiosMap.size} ratios, ${metricsMap.size} metrics, ${scoresMap.size} scores`,
    );

    // Serialize Maps to JSON and save to temp file (too large for args)
    const sharedDataPath = join(process.cwd(), "data", "fmp-shared-data.json");
    const sharedData = {
      industryPerformanceMap: Object.fromEntries(
        Array.from(industryPerformanceMap.entries()).map(([k, v]) => [
          k,
          Object.fromEntries(v),
        ]),
      ),
      universeMap: Object.fromEntries(universeMap),
      allSectorPerformance: Object.fromEntries(allSectorPerformance),
      snapshotDate: SNAPSHOT_DATE,
      profilesMap: Object.fromEntries(profilesMap),
      ratiosMap: Object.fromEntries(ratiosMap),
      metricsMap: Object.fromEntries(metricsMap),
      scoresMap: Object.fromEntries(scoresMap),
    };

    console.log("💾 Writing shared data to temp file...");
    writeFileSync(sharedDataPath, JSON.stringify(sharedData));
    console.log(`✅ Shared data written to ${sharedDataPath}\n`);

    // 4. Divide tickers into chunks
    const chunks = chunkArray(tickers, NUM_WORKERS);
    console.log(
      `📦 Divided ${tickers.length} tickers into ${NUM_WORKERS} chunks:`,
    );
    chunks.forEach((chunk, i) => {
      console.log(`   Worker ${i + 1}: ${chunk.length} tickers`);
    });
    console.log();

    // 5. Launch workers in parallel
    console.log("🚀 Launching workers...\n");

    const workerPromises = chunks.map((chunk, index) =>
      runWorker(index + 1, chunk, sharedDataPath),
    );

    const results = await Promise.allSettled(workerPromises);

    // 6. Report results
    console.log("\n📊 RESULTS:");
    let totalProcessed = 0;
    let totalErrors = 0;

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const { processed, errors } = result.value;
        totalProcessed += processed;
        totalErrors += errors.length;
        console.log(
          `✅ Worker ${index + 1}: ${processed} processed, ${errors.length} errors`,
        );
      } else {
        console.error(`❌ Worker ${index + 1}: ${result.reason}`);
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`\n🏁 FINISHED in ${elapsed} minutes`);
    console.log(`📊 Total processed: ${totalProcessed}`);
    console.log(`⚠️  Total errors: ${totalErrors}`);

    // Cleanup temp file
    try {
      unlinkSync(sharedDataPath);
      console.log("🗑️  Cleaned up temp file");
    } catch (e) {
      console.warn("⚠️  Could not cleanup temp file:", e);
    }
  } finally {
    // 7. Release lock
    await releaseLock(lockName);
    console.log("🔓 Lock released");
  }
}

// Run
main().catch((error) => {
  console.error("💥 FATAL ERROR:", error);
  process.exit(1);
});
