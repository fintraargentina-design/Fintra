/**
 * Backup Database Schema - Export all table schemas using pg_dump style
 * Usage: npx tsx scripts/backup-database-schema-simple.ts
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeFileSync } from "fs";
import { join } from "path";

async function backupDatabaseSchema() {
  console.log("🔄 Starting database schema backup (simple method)...\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const outputFile = join(process.cwd(), `backup-schema-${timestamp}.sql`);

  let sqlOutput = `-- =============================================
-- FINTRA DATABASE SCHEMA BACKUP
-- Generated: ${new Date().toISOString()}
-- Method: Simple table list + column export
-- =============================================

`;

  try {
    // List of main Fintra tables (from your codebase analysis)
    const fintraTables = [
      "fintra_universe",
      "fintra_market_state",
      "fintra_snapshots",
      "company_profile",
      "financial_statements",
      "prices_daily",
      "performance",
      "performance_windows",
      "sector_performance",
      "sector_performance_windows",
      "industry_performance",
      "industry_performance_windows",
      "sector_benchmarks",
      "industry_benchmarks",
      "sector_pe_aggregates",
      "industry_pe_aggregates",
      "ttm_valuation",
      "dividends",
      "company_peers",
      "industry_classification",
      "industry_metadata",
    ];

    console.log(`📋 Processing ${fintraTables.length} known Fintra tables\n`);

    for (const tableName of fintraTables) {
      try {
        sqlOutput += await getTableSchemaSimple(tableName);
      } catch (error) {
        console.log(`  ⚠️  Skipping ${tableName}: ${error}`);
      }
    }

    // Write to file
    writeFileSync(outputFile, sqlOutput, "utf8");

    console.log("\n✅ Schema backup completed!");
    console.log(`📁 File saved: ${outputFile}`);
    console.log(`📊 Size: ${(sqlOutput.length / 1024).toFixed(2)} KB\n`);
  } catch (error) {
    console.error("❌ Error during backup:", error);
    throw error;
  }
}

async function getTableSchemaSimple(tableName: string): Promise<string> {
  console.log(`  📄 Exporting: public.${tableName}`);

  let output = `\n-- =============================================\n`;
  output += `-- Table: public.${tableName}\n`;
  output += `-- =============================================\n\n`;

  try {
    // Try to get one row to infer schema
    const { data, error } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows
      throw new Error(`Table not found or inaccessible: ${error.message}`);
    }

    const sampleRow = data || {};
    const columns = Object.keys(sampleRow);

    if (columns.length === 0) {
      // Try to get count at least
      const { count } = await supabaseAdmin
        .from(tableName)
        .select("*", { count: "exact", head: true });

      output += `-- Table exists but has no data yet (count: ${count || 0})\n`;
      output += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
      output += `    -- Schema unknown (empty table)\n`;
      output += `);\n\n`;

      return output;
    }

    // Build CREATE TABLE with inferred types
    output += `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;

    const columnDefs: string[] = [];

    for (const col of columns) {
      const value = sampleRow[col];
      let colType = "TEXT"; // default

      if (value === null) {
        colType = "TEXT"; // unknown, assume text
      } else if (typeof value === "number") {
        colType = Number.isInteger(value) ? "BIGINT" : "DOUBLE PRECISION";
      } else if (typeof value === "boolean") {
        colType = "BOOLEAN";
      } else if (typeof value === "string") {
        // Check if it's a date
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
          colType = value.includes("T") ? "TIMESTAMPTZ" : "DATE";
        } else {
          colType = "TEXT";
        }
      } else if (typeof value === "object") {
        colType = "JSONB";
      }

      columnDefs.push(`    ${col} ${colType}`);
    }

    output += columnDefs.join(",\n");
    output += `\n);\n\n`;

    // Get row count
    const { count } = await supabaseAdmin
      .from(tableName)
      .select("*", { count: "exact", head: true });

    output += `-- Row count: ${count || 0}\n\n`;
  } catch (error: any) {
    output += `-- Error retrieving schema: ${error.message}\n\n`;
  }

  return output;
}

// Execute backup
backupDatabaseSchema()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
