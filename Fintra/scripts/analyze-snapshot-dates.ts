// Analyze snapshot date distribution
import { loadEnv } from "./utils/load-env";
loadEnv();

import { supabaseAdmin } from "@/lib/supabase-admin";

async function analyzeDateDistribution() {
  console.log("📊 Análisis de Distribución de Snapshots por Fecha\n");

  const { data, error } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("snapshot_date")
    .not("ifs", "is", null)
    .order("snapshot_date", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("❌ Error:", error);
    return;
  }

  // Group by date
  const byDate = new Map<string, number>();
  for (const row of data) {
    const date = row.snapshot_date;
    byDate.set(date, (byDate.get(date) || 0) + 1);
  }

  const dates = Array.from(byDate.keys()).sort().reverse();

  console.log(`Total snapshots analizados: ${data.length}`);
  console.log(`Fechas únicas: ${dates.length}\n`);
  console.log("📅 Top 20 fechas con más snapshots:\n");

  for (const date of dates.slice(0, 20)) {
    const count = byDate.get(date)!;
    const year = date.slice(0, 4);
    console.log(
      `   ${date} (${year}): ${count.toLocaleString().padStart(5)} snapshots`,
    );
  }

  // Group by year
  console.log("\n📆 Snapshots por año:\n");
  const byYear = new Map<string, number>();
  for (const [date, count] of byDate.entries()) {
    const year = date.slice(0, 4);
    byYear.set(year, (byYear.get(year) || 0) + count);
  }

  const years = Array.from(byYear.keys()).sort().reverse();
  for (const year of years) {
    const count = byYear.get(year)!;
    const percent = ((count / data.length) * 100).toFixed(1);
    console.log(
      `   ${year}: ${count.toLocaleString().padStart(5)} (${percent}%)`,
    );
  }

  // Check if we have historical data
  console.log("\n🔍 Diagnóstico:\n");
  if (years.length === 1 && years[0] === "2026") {
    console.log("   ❌ PROBLEMA DETECTADO: Solo hay snapshots de 2026");
    console.log("   ❌ No existen snapshots históricos (2021-2025)");
    console.log("   ⚠️ Por eso todos los tickers tienen observed_years = 1");
    console.log(
      "\n   💡 Solución: Necesitas ejecutar el pipeline de snapshots históricos",
    );
    console.log("      o hacer backfill de años anteriores");
  } else {
    console.log("   ✅ Hay snapshots históricos disponibles");
  }
}

analyzeDateDistribution().catch(console.error);
