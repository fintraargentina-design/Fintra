/**
 * Backup Database Schema - Export all table schemas to SQL file
 * Usage: npx tsx scripts/backup-database-schema.ts
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeFileSync } from "fs";
import { join } from "path";

async function backupDatabaseSchema() {
  console.log("🔄 Starting database schema backup...\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const outputFile = join(process.cwd(), `backup-schema-${timestamp}.sql`);

  let sqlOutput = `-- =============================================
-- FINTRA DATABASE SCHEMA BACKUP
-- Generated: ${new Date().toISOString()}
-- =============================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

`;

  try {
    // Get all tables using SQL query
    const tablesQuery = `
      SELECT 
        schemaname as table_schema,
        tablename as table_name
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime', 'supabase_functions', 'extensions')
      ORDER BY schemaname, tablename;
    `;

    const { data: tables, error: tablesError } = await supabaseAdmin.rpc(
      "exec_sql",
      { sql: tablesQuery },
    );

    if (tablesError) {
      console.error("Error fetching tables:", tablesError);

      // Ultimate fallback: just get public schema tables
      console.log("Using fallback method for public schema only...\n");

      const publicTablesQuery = `
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
      `;

      const { data: publicTables, error: publicError } =
        await supabaseAdmin.rpc("exec_sql", { sql: publicTablesQuery });

      if (publicError || !publicTables) {
        console.error("Fallback also failed:", publicError);
        return;
      }

      console.log(`📋 Found ${publicTables.length} tables in public schema\n`);

      for (const table of publicTables) {
        sqlOutput += await getTableSchema("public", table.tablename);
      }
    } else {
      console.log(`📋 Found ${tables?.length || 0} tables\n`);

      for (const table of tables || []) {
        sqlOutput += await getTableSchema(table.table_schema, table.table_name);
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

async function getTableSchema(
  schema: string,
  tableName: string,
): Promise<string> {
  console.log(`  📄 Exporting: ${schema}.${tableName}`);

  let output = `\n-- =============================================\n`;
  output += `-- Table: ${schema}.${tableName}\n`;
  output += `-- =============================================\n\n`;

  try {
    // Get columns
    const { data: columns } = await supabaseAdmin.rpc("exec_sql", {
      sql_query: `
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = '${schema}'
            AND table_name = '${tableName}'
          ORDER BY ordinal_position;
        `,
    });

    if (!columns || columns.length === 0) {
      output += `-- Unable to retrieve schema for ${schema}.${tableName}\n`;
      return output;
    }

    // Build CREATE TABLE statement
    output += `CREATE TABLE IF NOT EXISTS ${schema}.${tableName} (\n`;

    const columnDefs: string[] = [];

    for (const col of columns) {
      let colDef = `    ${col.column_name} ${col.data_type}`;

      if (col.character_maximum_length) {
        colDef += `(${col.character_maximum_length})`;
      }

      if (col.is_nullable === "NO") {
        colDef += " NOT NULL";
      }

      if (col.column_default) {
        colDef += ` DEFAULT ${col.column_default}`;
      }

      columnDefs.push(colDef);
    }

    output += columnDefs.join(",\n");
    output += `\n);\n\n`;

    // Get indexes
    const { data: indexes } = await supabaseAdmin.rpc("exec_sql", {
      sql_query: `
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = '${schema}'
            AND tablename = '${tableName}'
            AND indexname NOT LIKE '%_pkey';
        `,
    });

    if (indexes && indexes.length > 0) {
      output += `-- Indexes for ${schema}.${tableName}\n`;
      for (const idx of indexes) {
        output += `${idx.indexdef};\n`;
      }
      output += "\n";
    }

    // Get constraints
    const { data: constraints } = await supabaseAdmin.rpc("exec_sql", {
      sql_query: `
          SELECT 
            conname,
            pg_get_constraintdef(oid) as condef
          FROM pg_constraint
          WHERE conrelid = '${schema}.${tableName}'::regclass;
        `,
    });

    if (constraints && constraints.length > 0) {
      output += `-- Constraints for ${schema}.${tableName}\n`;
      for (const con of constraints) {
        output += `ALTER TABLE ${schema}.${tableName} ADD CONSTRAINT ${con.conname} ${con.condef};\n`;
      }
      output += "\n";
    }
  } catch (error) {
    output += `-- Error retrieving schema: ${error}\n\n`;
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
