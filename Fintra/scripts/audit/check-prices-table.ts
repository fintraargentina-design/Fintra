/**
 * Check if prices_daily table exists and has any data
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  console.log("🔍 Verificando tabla prices_daily...\n");

  // Check table structure
  const { data: sample, error: sampleError } = await supabaseAdmin
    .from("prices_daily")
    .select("*")
    .limit(1);

  if (sampleError) {
    console.error("❌ Error consultando prices_daily:", sampleError.message);
    console.log(
      '\n🔍 Buscando tablas alternativas con "price" en el nombre...\n',
    );

    // List all tables
    const { data: tables } = await supabaseAdmin
      .from("information_schema.tables" as any)
      .select("table_name")
      .eq("table_schema", "public")
      .like("table_name", "%price%");

    if (tables && tables.length > 0) {
      console.log("📋 Tablas encontradas:");
      tables.forEach((t: any) => console.log(`   - ${t.table_name}`));
    }

    return;
  }

  console.log("✅ Tabla prices_daily existe\n");

  if (sample && sample.length > 0) {
    console.log("📄 Sample row:");
    console.log(JSON.stringify(sample[0], null, 2));
    console.log("\n");
  } else {
    console.log("⚠️  Tabla existe pero está VACÍA (0 registros)\n");
  }

  // Check count
  const { count } = await supabaseAdmin
    .from("prices_daily")
    .select("*", { count: "exact", head: true });

  console.log(`📊 Total registros: ${count?.toLocaleString() || 0}`);

  if (count && count > 0) {
    // Get date range
    const { data: minDate } = await supabaseAdmin
      .from("prices_daily")
      .select("price_date")
      .order("price_date", { ascending: true })
      .limit(1);

    const { data: maxDate } = await supabaseAdmin
      .from("prices_daily")
      .select("price_date")
      .order("price_date", { ascending: false })
      .limit(1);

    if (minDate && maxDate && minDate.length > 0 && maxDate.length > 0) {
      console.log(
        `📅 Rango: ${minDate[0].price_date} → ${maxDate[0].price_date}`,
      );
    }
  } else {
    console.log("\n❌ PROBLEMA CRÍTICO: prices_daily está vacía");
    console.log("   Esta tabla debería tener datos desde ~2000");
    console.log("\n📋 SOLUCIÓN:");
    console.log("   Ejecutar backfill masivo:");
    console.log(
      "   npx tsx scripts/pipeline/03-prices-daily-bulk.ts --start=2000-01-01 --end=2026-02-08",
    );
  }
}

main().catch(console.error);
