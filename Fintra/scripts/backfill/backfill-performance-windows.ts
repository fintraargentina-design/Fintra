/**
 * BACKFILL: performance_windows table
 *
 * PURPOSE:
 * Populate performance_windows from datos_performance + sector_performance + fintra_universe
 *
 * ARCHITECTURE:
 * - Reads asset returns from datos_performance
 * - Reads benchmark returns from sector_performance
 * - Joins via fintra_universe (ticker → sector mapping)
 * - Inserts into performance_windows (no schema changes)
 *
 * DATA RULES:
 * - Skip if asset_return is NULL
 * - Skip if benchmark_return is NULL
 * - alpha = asset_return - benchmark_return (computed)
 * - volatility, max_drawdown = NULL (not computed)
 * - Deterministic: same inputs → same outputs
 *
 * USAGE:
 * npx tsx scripts/backfill/backfill-performance-windows.ts
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load environment
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
}

const BACKFILL_SOURCE = "backfill_v1_2026_02_02";
const BATCH_SIZE = 1000;

// Canonical windows contract
const WINDOWS = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y"];

async function main() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  console.log("🚀 Starting performance_windows backfill...");
  console.log(`   Source: ${BACKFILL_SOURCE}`);
  console.log(`   Windows: ${WINDOWS.join(", ")}`);
  console.log("");

  // Step 1: Find available dates in both tables
  console.log("Step 1: Finding available dates...");

  const { data: latestAsset } = await supabaseAdmin
    .from("datos_performance")
    .select("performance_date")
    .in("window_code", WINDOWS)
    .order("performance_date", { ascending: false })
    .limit(1)
    .single();

  const { data: latestBenchmark } = await supabaseAdmin
    .from("sector_performance")
    .select("performance_date")
    .order("performance_date", { ascending: false })
    .limit(1)
    .single();

  if (!latestAsset || !latestBenchmark) {
    console.error("❌ Cannot find data in source tables");
    process.exit(1);
  }

  const assetDate = latestAsset.performance_date;
  const benchmarkDate = latestBenchmark.performance_date;

  console.log(`   Asset data (datos_performance): ${assetDate}`);
  console.log(`   Benchmark data (sector_performance): ${benchmarkDate}`);
  console.log("");

  // Strategy: Use asset date (most recent) with closest available benchmarks
  // This is acceptable for backfill as benchmarks change slowly
  const targetDate = assetDate; // Use latest asset data
  const benchmarkDateToUse = benchmarkDate; // Use available benchmarks

  if (targetDate !== benchmarkDateToUse) {
    console.log(
      `   ⚠️  Date mismatch: Asset(${targetDate}) vs Benchmark(${benchmarkDateToUse})`,
    );
    console.log(
      `   Strategy: Using asset date ${targetDate} with benchmarks from ${benchmarkDateToUse}`,
    );
    console.log(
      `   This is acceptable for backfill (sector returns change slowly)`,
    );
  }

  console.log(`   ✓ Target date: ${targetDate}`);
  console.log("");

  // Step 2: Load sector benchmarks for target date
  console.log("Step 2: Loading sector benchmarks...");
  const { data: benchmarks, error: benchError } = await supabaseAdmin
    .from("sector_performance")
    .select("sector, window_code, return_percent")
    .eq("performance_date", benchmarkDateToUse)
    .in("window_code", WINDOWS);

  if (benchError || !benchmarks) {
    console.error("❌ Failed to load benchmarks:", benchError);
    process.exit(1);
  }

  // Create benchmark lookup: sector_windowCode → return_percent
  const benchmarkMap = new Map<string, number>();
  benchmarks.forEach((b: any) => {
    const key = `${b.sector}|${b.window_code}`;
    benchmarkMap.set(key, b.return_percent);
  });

  console.log(`   ✓ Loaded ${benchmarks.length} benchmark rows`);
  console.log(
    `   ✓ Unique sectors: ${new Set(benchmarks.map((b: any) => b.sector)).size}`,
  );
  console.log("");

  // Step 3: Load ticker → sector mapping (paginated)
  console.log("Step 3: Loading ticker-sector mappings...");

  const allUniverse: any[] = [];
  let universePage = 0;
  const universePageSize = 1000; // Supabase max per query

  while (true) {
    const { data: pageData } = await supabaseAdmin
      .from("fintra_universe")
      .select("ticker, sector")
      .not("sector", "is", null)
      .range(
        universePage * universePageSize,
        (universePage + 1) * universePageSize - 1,
      );

    if (!pageData || pageData.length === 0) break;

    allUniverse.push(...pageData);
    console.log(
      `   ✓ Page ${universePage + 1}: ${pageData.length} ticker mappings (total: ${allUniverse.length})`,
    );

    if (pageData.length < universePageSize) break; // Last page
    universePage++;
  }

  const tickerSectorMap = new Map<string, string>();
  allUniverse.forEach((u: any) => {
    tickerSectorMap.set(u.ticker, u.sector);
  });

  console.log(`   ✓ Total ticker mappings loaded: ${tickerSectorMap.size}`);
  console.log("");

  // Step 4: Load asset performance data
  console.log("Step 4: Loading asset performance data...");

  // Paginate to load all rows (Supabase limit is 1000 per query)
  const allAssetPerf: any[] = [];
  let page = 0;
  const pageSize = 1000; // Supabase max per query

  while (true) {
    const { data: pageData, error: pageError } = await supabaseAdmin
      .from("datos_performance")
      .select("ticker, window_code, return_percent")
      .eq("performance_date", targetDate)
      .in("window_code", WINDOWS)
      .not("return_percent", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order("ticker");

    if (pageError) {
      console.error(`❌ Failed to load page ${page + 1}:`, pageError);
      process.exit(1);
    }

    if (!pageData || pageData.length === 0) break;

    allAssetPerf.push(...pageData);
    console.log(
      `   ✓ Page ${page + 1}: ${pageData.length} rows (total: ${allAssetPerf.length})`,
    );

    if (pageData.length < pageSize) break; // Last page
    page++;
  }

  const assetPerf = allAssetPerf;

  console.log(`   ✓ Total asset performance rows loaded: ${assetPerf.length}`);

  if (assetPerf.length === 0) {
    console.error(`❌ No asset performance data found for ${targetDate}`);
    process.exit(1);
  }

  console.log("");
  console.log("");

  // Step 5: Build performance_windows rows
  console.log("Step 5: Building performance_windows rows...");

  const rows: any[] = [];
  let skippedNoSector = 0;
  let skippedNoBenchmark = 0;

  for (const asset of assetPerf) {
    const ticker = asset.ticker;
    const windowCode = asset.window_code;
    const assetReturn = asset.return_percent;

    // Skip if no asset return (should not happen due to filter, but defensive)
    if (assetReturn == null) continue;

    // Get sector for this ticker
    const sector = tickerSectorMap.get(ticker);
    if (!sector) {
      skippedNoSector++;
      continue;
    }

    // Get benchmark return for this sector + window
    const benchmarkKey = `${sector}|${windowCode}`;
    const benchmarkReturn = benchmarkMap.get(benchmarkKey);
    if (benchmarkReturn == null) {
      skippedNoBenchmark++;
      continue;
    }

    // Compute alpha (relative performance)
    const alpha = assetReturn - benchmarkReturn;

    // Build row
    rows.push({
      ticker: ticker,
      benchmark_ticker: sector, // Store sector as benchmark identifier
      window_code: windowCode,
      asset_return: assetReturn,
      benchmark_return: benchmarkReturn,
      alpha: alpha,
      volatility: null, // Not computed in this backfill
      max_drawdown: null, // Not computed in this backfill
      as_of_date: targetDate,
      source: BACKFILL_SOURCE,
      created_at: new Date().toISOString(),
    });
  }

  console.log(`   ✓ Built ${rows.length} valid rows`);
  console.log(`   ⚠ Skipped ${skippedNoSector} rows (no sector mapping)`);
  console.log(`   ⚠ Skipped ${skippedNoBenchmark} rows (no benchmark data)`);
  console.log("");

  if (rows.length === 0) {
    console.log("❌ No valid rows to insert. Check data availability.");
    process.exit(1);
  }

  // Step 5b: Deduplicate rows (keep first occurrence per unique key)
  console.log("Step 5b: Deduplicating rows...");
  const uniqueRows = new Map<string, any>();

  for (const row of rows) {
    const key = `${row.ticker}|${row.benchmark_ticker}|${row.window_code}|${row.as_of_date}`;
    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, row);
    }
  }

  const deduplicatedRows = Array.from(uniqueRows.values());
  const duplicatesRemoved = rows.length - deduplicatedRows.length;

  console.log(`   ✓ Original rows: ${rows.length}`);
  console.log(`   ✓ Unique rows: ${deduplicatedRows.length}`);
  console.log(`   ✓ Duplicates removed: ${duplicatesRemoved}`);
  console.log("");

  // Step 6: Clear existing data for this date (idempotent)
  console.log("Step 6: Clearing existing data for target date...");
  const { error: deleteError } = await supabaseAdmin
    .from("performance_windows")
    .delete()
    .eq("as_of_date", targetDate)
    .eq("source", BACKFILL_SOURCE);

  if (deleteError) {
    console.error("❌ Failed to clear existing data:", deleteError);
    process.exit(1);
  }
  console.log("   ✓ Cleared existing rows");
  console.log("");

  // Step 7: Insert in batches (use UPSERT to handle any remaining duplicates)
  console.log("Step 7: Inserting rows...");
  let inserted = 0;

  for (let i = 0; i < deduplicatedRows.length; i += BATCH_SIZE) {
    const batch = deduplicatedRows.slice(i, i + BATCH_SIZE);

    const { error: insertError } = await supabaseAdmin
      .from("performance_windows")
      .upsert(batch, {
        onConflict: "ticker,benchmark_ticker,window_code,as_of_date",
        ignoreDuplicates: false, // Update if exists
      });

    if (insertError) {
      console.error(
        `❌ Failed to insert batch ${i / BATCH_SIZE + 1}:`,
        insertError,
      );
      process.exit(1);
    }

    inserted += batch.length;
    console.log(
      `   ✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} rows (total: ${inserted})`,
    );
  }

  console.log("");
  console.log("✅ Backfill complete!");
  console.log(`   Total rows inserted: ${inserted}`);
  console.log(`   Date: ${targetDate}`);
  console.log(`   Windows: ${WINDOWS.join(", ")}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Verify: SELECT COUNT(*) FROM performance_windows;");
  console.log("2. Run snapshot generation to populate fintra_snapshots");
  console.log("3. Check scatter chart for dispersed points");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
