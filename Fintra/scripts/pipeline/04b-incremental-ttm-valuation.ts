/**
 * Incremental TTM Valuation Cron Job (Optimized Bulk Version)
 *
 * PURPOSE:
 * Detects newly closed fiscal quarters and creates ONE new TTM row per ticker
 *
 * OPTIMIZATION (Level 2):
 * - Uses vectorized queries to detect "dirty" tickers (Latest Quarter > Latest TTM)
 * - Processes only candidates that need updates
 * - Performs bulk inserts for efficiency
 * - Eliminates N+1 query problem for "up to date" tickers
 *
 * ARCHITECTURE:
 * - Delegates core logic to app/api/cron/incremental-ttm-valuation-bulk/core.ts
 *
 * USAGE:
 * pnpm tsx scripts/pipeline/incremental-ttm-valuation.ts
 */

import { loadEnv } from "../utils/load-env";
import { runIncrementalTTMValuationBulk } from "@/app/api/cron/incremental-ttm-valuation-bulk/core";

loadEnv();

async function getActiveTickers(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("fintra_universe")
    .select("ticker")
    .eq("is_active", true)
    .order("ticker", { ascending: true });

  if (error) {
    console.error("❌ Error fetching tickers:", error.message);
    return [];
  }

  return data?.map((d) => d.ticker) || [];
}

async function main() {
  console.log("🔄 Starting Incremental TTM Valuation Cron (Bulk Optimized)...\n");
  console.log("═══════════════════════════════════════════════════════════");

  const tickers = await getActiveTickers();
  console.log(`📋 Processing ${tickers.length} active tickers\n`);

  let newTTMsCreated = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  // Process in chunks of 50
  const CHUNK_SIZE = 50;

  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);
    
    try {
        const results = await runIncrementalTTMValuationBulk(chunk);
        
        results.forEach(r => {
            if (r.status === 'created') newTTMsCreated++;
            else if (r.status === 'skipped') skipped++;
            else errors++;
        });

        // Optional: Detailed log for creations
        const created = results.filter(r => r.status === 'created');
        if (created.length > 0) {
            console.log(`   ✨ Created ${created.length} new TTM rows in this batch: ${created.map(c => c.ticker).join(', ')}`);
        }

    } catch (err) {
        console.error(`❌ Critical Batch Error at index ${i}:`, err);
        errors += chunk.length;
    }

    processed += chunk.length;
    
    // Progress Log every 200 items
    if (processed % 200 === 0 || processed >= tickers.length) {
         console.log(
          `\n📈 Progress: ${Math.min(processed, tickers.length)}/${tickers.length} | Created: ${newTTMsCreated} | Skipped: ${skipped} | Errors: ${errors}\n`,
        );
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("✨ Incremental TTM Cron Complete!");
  console.log(`   Total Processed: ${tickers.length}`);
  console.log(`   New TTM rows:    ${newTTMsCreated}`);
  console.log(`   Up to date:      ${skipped}`);
  console.log(`   Errors:          ${errors}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

// For direct execution
if (require.main === module) {
  main().catch(console.error);
}

// For Next.js API route
export { main as incrementalTTMValuation };
