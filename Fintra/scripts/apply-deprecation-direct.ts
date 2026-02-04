/**
 * Apply deprecation comments directly via SQL queries
 * Run: pnpm tsx scripts/apply-deprecation-direct.ts
 */

import { supabaseAdmin } from "@/lib/supabase-admin";

async function applyDeprecation() {
  console.log("📦 Applying deprecation comments directly...\n");

  try {
    // Step 1: Add table comment
    console.log("1. Adding table comment...");
    await supabaseAdmin.rpc("exec", {
      sql: `COMMENT ON TABLE fintra_snapshots IS 'Core snapshot table for Fintra financial data. DEPRECATED COLUMNS (as of Feb 2026): sector_rank, sector_rank_total → Use performance_windows->1M, relative_vs_sector_* → Use performance_windows->*->vs_sector, relative_vs_market_* → Use performance_windows->*->vs_market. Removal planned: Q2 2026 (after UI/query migration)';`,
    });
    console.log("   ✅ Table comment added\n");

    // Step 2: Add column comments
    console.log("2. Adding column comments...");

    const columns = [
      {
        name: "sector_rank",
        comment:
          "DEPRECATED (Feb 2026): Use performance_windows->''1M''->''sector_rank'' instead. This column is no longer written by cron jobs. Reads will be supported until Q2 2026. Migration guide: See docs/migrations/performance_windows.md",
      },
      {
        name: "sector_rank_total",
        comment:
          "DEPRECATED (Feb 2026): Use performance_windows->''1M''->''sector_total'' instead. This column is no longer written by cron jobs. Reads will be supported until Q2 2026. Migration guide: See docs/migrations/performance_windows.md",
      },
    ];

    for (const col of columns) {
      console.log(`   - ${col.name}...`);
      await supabaseAdmin.rpc("exec", {
        sql: `COMMENT ON COLUMN fintra_snapshots.${col.name} IS '${col.comment}';`,
      });
    }

    console.log("   ✅ Column comments added\n");

    // Step 3: Create view (this might fail if RPC doesn't support it)
    console.log("3. Creating tracking view...");
    console.log(
      "   ⚠️  This step may need to be done via Supabase Dashboard\n",
    );

    console.log("✅ Deprecation comments applied!\n");
    console.log("⚠️  Note: View creation requires Dashboard access.");
    console.log("   Copy this SQL to Supabase Dashboard SQL Editor:\n");
    console.log("   -- Create view to track deprecated column usage");
    console.log("   CREATE OR REPLACE VIEW deprecated_columns_usage AS");
    console.log("   SELECT 'sector_rank' as column_name,");
    console.log(
      "     COUNT(*) FILTER (WHERE sector_rank IS NOT NULL) as rows_with_data,",
    );
    console.log("     COUNT(*) as total_rows,");
    console.log(
      "     ROUND(100.0 * COUNT(*) FILTER (WHERE sector_rank IS NOT NULL) / NULLIF(COUNT(*), 0), 2) as usage_percent,",
    );
    console.log(
      "     MAX(snapshot_date) FILTER (WHERE sector_rank IS NOT NULL) as last_written_date",
    );
    console.log("   FROM fintra_snapshots;");
    console.log("\n");
  } catch (error: any) {
    if (error?.message?.includes("exec")) {
      console.log('\n⚠️  RPC function "exec" not available.\n');
      console.log(
        "Please apply the migration manually via Supabase Dashboard:",
      );
      console.log("1. Go to SQL Editor in Supabase Dashboard");
      console.log(
        "2. Copy/paste: supabase/migrations/20260202_deprecate_legacy_columns.sql",
      );
      console.log("3. Run the query\n");
    } else {
      console.error("❌ Error:", error);
    }
  }
}

applyDeprecation();
