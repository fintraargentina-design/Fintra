/**
 * Apply deprecation migration for legacy columns
 * Run: pnpm tsx scripts/apply-deprecation-migration.ts
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import fs from "fs";
import path from "path";

async function applyMigration() {
  console.log("📦 Checking deprecation migration status...\n");

  // Read migration file
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260202_deprecate_legacy_columns.sql",
  );

  console.log(
    "⚠️  Note: Supabase JS client cannot execute DDL (COMMENT, CREATE VIEW) directly.\n",
  );
  console.log("To apply this migration, use one of these methods:\n");
  console.log("1. Supabase Dashboard:");
  console.log("   → SQL Editor → Paste contents of:");
  console.log(
    "   → supabase/migrations/20260202_deprecate_legacy_columns.sql\n",
  );
  console.log("2. Supabase CLI (if installed):");
  console.log("   → supabase db push\n");
  console.log("3. Direct PostgreSQL connection (if psql installed):");
  console.log(
    "   → psql $DATABASE_URL -f supabase/migrations/20260202_deprecate_legacy_columns.sql\n",
  );

  // Try to verify if view already exists (if migration was applied manually)
  try {
    console.log("🔍 Checking if migration already applied...\n");

    const { data, error } = await supabaseAdmin
      .from("deprecated_columns_usage")
      .select("*")
      .limit(1);

    if (!error) {
      console.log("✅ Migration appears to be ALREADY APPLIED!");
      console.log('   View "deprecated_columns_usage" exists.\n');

      const { data: usage } = await supabaseAdmin
        .from("deprecated_columns_usage")
        .select("*");

      if (usage && usage.length > 0) {
        console.log("📊 Current deprecated columns usage:\n");
        console.table(usage);
        console.log("\n");
      }

      console.log("✅ Next steps:");
      console.log("1. Run: pnpm audit:deprecated-columns");
      console.log("2. Proceed with Phase 2 migration when ready\n");
    } else if (error.code === "42P01") {
      console.log("⏳ Migration NOT YET applied.");
      console.log('   View "deprecated_columns_usage" does not exist.');
      console.log("   Please apply via one of the methods above.\n");
    } else {
      console.error("❌ Error checking migration status:", error);
    }
  } catch (e) {
    console.log("⏳ Migration NOT YET applied.\n");
    console.log("Migration file location:");
    console.log(`   ${migrationPath}\n`);
  }
}

applyMigration();

applyMigration();
