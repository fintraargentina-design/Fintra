/**
 * Audit: prices_daily coverage
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  console.log("📊 AUDITANDO COBERTURA DE prices_daily\n");

  // 1. Total rows
  const { count: totalRows } = await supabaseAdmin
    .from("prices_daily")
    .select("*", { count: "exact", head: true });

  console.log(`📦 Total registros: ${totalRows?.toLocaleString() || 0}\n`);

  if (!totalRows || totalRows === 0) {
    console.log("❌ Tabla vacía");
    return;
  }

  // 2. Date range
  const { data: dates } = await supabaseAdmin
    .from("prices_daily")
    .select("price_date")
    .order("price_date", { ascending: true });

  if (!dates || dates.length === 0) {
    console.log("❌ No se pudieron obtener fechas");
    return;
  }

  const uniqueDates = [...new Set(dates.map((d) => d.price_date))].sort();
  const firstDate = uniqueDates[0];
  const lastDate = uniqueDates[uniqueDates.length - 1];

  console.log("📅 Rango de fechas:");
  console.log(`   Primera: ${firstDate}`);
  console.log(`   Última:  ${lastDate}`);
  console.log(`   Días únicos: ${uniqueDates.length}\n`);

  // 3. Check sufficiency for IFS windows
  const daysNeeded = {
    "3M": 90,
    "6M": 180,
    "2Y": 730,
  };

  console.log("✅ Suficiencia para IFS Live:");

  if (uniqueDates.length >= daysNeeded["3M"]) {
    console.log(`   ✅ 3M window: ${uniqueDates.length} ≥ 90 días`);
  } else {
    console.log(
      `   ❌ 3M window: ${uniqueDates.length} < 90 días (faltan ${daysNeeded["3M"] - uniqueDates.length})`,
    );
  }

  if (uniqueDates.length >= daysNeeded["6M"]) {
    console.log(`   ✅ 6M window: ${uniqueDates.length} ≥ 180 días`);
  } else {
    console.log(
      `   ❌ 6M window: ${uniqueDates.length} < 180 días (faltan ${daysNeeded["6M"] - uniqueDates.length})`,
    );
  }

  if (uniqueDates.length >= daysNeeded["2Y"]) {
    console.log(`   ✅ 2Y window: ${uniqueDates.length} ≥ 730 días`);
  } else {
    console.log(
      `   ❌ 2Y window: ${uniqueDates.length} < 730 días (faltan ${daysNeeded["2Y"] - uniqueDates.length})`,
    );
  }

  // 4. Recent dates
  console.log("\n📅 Últimas 10 fechas disponibles:");
  uniqueDates.slice(-10).forEach((d) => console.log(`   - ${d}`));

  // 5. Sample ticker coverage
  const { data: sampleTickers } = await supabaseAdmin
    .from("prices_daily")
    .select("ticker, price_date")
    .in("ticker", ["AAPL", "MSFT", "GOOGL"])
    .order("price_date", { ascending: false })
    .limit(15);

  if (sampleTickers && sampleTickers.length > 0) {
    console.log("\n🔍 Sample (AAPL/MSFT/GOOGL - últimas fechas):");
    sampleTickers.forEach((row) => {
      console.log(`   ${row.ticker}: ${row.price_date}`);
    });
  }

  // 6. Recommendation
  console.log("\n📋 RECOMENDACIÓN:");

  if (uniqueDates.length >= 730) {
    console.log("   ✅ Cobertura completa para IFS Live");
    console.log(
      "   ➡️  Ejecutar: npx tsx scripts/pipeline/13-performance-bulk.ts",
    );
    console.log(
      "   ➡️  Luego: npx tsx scripts/backfill/backfill-sector-performance-from-datos.ts",
    );
  } else if (uniqueDates.length >= 180) {
    console.log("   ⚠️  Cobertura parcial (6M disponible, 2Y falta)");
    console.log(`   ➡️  Backfill adicional: ${730 - uniqueDates.length} días`);
    const startDate = new Date(lastDate);
    startDate.setDate(startDate.getDate() - (730 - uniqueDates.length));
    console.log(
      `   📅 Comando: npx tsx scripts/pipeline/03-prices-daily-bulk.ts --start=${startDate.toISOString().split("T")[0]} --end=${firstDate}`,
    );
  } else if (uniqueDates.length >= 90) {
    console.log("   ⚠️  Cobertura mínima (solo 3M disponible)");
    console.log(`   ➡️  Backfill requerido: ${730 - uniqueDates.length} días`);
  } else {
    console.log("   ❌ Cobertura insuficiente (<90 días)");
    console.log(`   ➡️  Backfill URGENTE: ${730 - uniqueDates.length} días`);
    const startDate = new Date(lastDate);
    startDate.setDate(startDate.getDate() - 730);
    console.log(
      `   📅 Comando: npx tsx scripts/pipeline/03-prices-daily-bulk.ts --start=${startDate.toISOString().split("T")[0]} --end=${lastDate}`,
    );
  }
}

main().catch(console.error);
