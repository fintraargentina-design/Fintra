// Debug: Check AMZN historical snapshots
import { loadEnv } from "./utils/load-env";
loadEnv();

import { supabaseAdmin } from "@/lib/supabase-admin";

async function debugAMZN() {
  console.log("🔍 Debug AMZN Historical Snapshots\n");

  const { data, error } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, snapshot_date, ifs")
    .eq("ticker", "AMZN")
    .not("ifs", "is", null)
    .order("snapshot_date", { ascending: false });

  if (error) {
    console.error("❌ Error:", error);
    return;
  }

  console.log(`📊 Total snapshots for AMZN: ${data.length}\n`);

  // Group by year
  const byYear = new Map<string, any[]>();
  for (const row of data) {
    const year = row.snapshot_date.slice(0, 4);
    if (!byYear.has(year)) {
      byYear.set(year, []);
    }
    byYear.get(year)!.push(row);
  }

  console.log("📅 Snapshots por año:\n");
  const years = Array.from(byYear.keys()).sort().reverse();

  for (const year of years) {
    const snapshots = byYear.get(year)!;
    const lastOfYear = snapshots[snapshots.length - 1]; // Último del año (más antiguo en DESC)
    console.log(`   ${year}: ${snapshots.length} snapshots`);
    console.log(
      `      Rango: ${snapshots[snapshots.length - 1].snapshot_date} → ${snapshots[0].snapshot_date}`,
    );
    console.log(
      `      Último del año: ${lastOfYear.snapshot_date} | IFS: ${lastOfYear.ifs?.position || "N/A"}`,
    );
  }

  console.log("\n🎯 Top 5 años para timeline:");
  const top5Years = years.slice(0, 5);
  for (const year of top5Years) {
    const snapshots = byYear.get(year)!;
    const lastOfYear = snapshots[snapshots.length - 1];
    console.log(`   ${year}: ${lastOfYear.ifs?.position || "N/A"}`);
  }

  // Simulate aggregator logic
  console.log("\n🔧 Simulando lógica del agregador:\n");

  const byYearForAggregator = new Map<string, any>();
  const sortedDesc = [...data].sort((a, b) =>
    b.snapshot_date.localeCompare(a.snapshot_date),
  );

  for (const row of sortedDesc) {
    const year = row.snapshot_date.slice(0, 4);
    if (!byYearForAggregator.has(year)) {
      byYearForAggregator.set(year, row);
    }
  }

  const yearsForTimeline = Array.from(byYearForAggregator.keys())
    .sort()
    .reverse()
    .slice(0, 5);
  const annualSnapshots = yearsForTimeline.map(
    (y) => byYearForAggregator.get(y)!,
  );

  console.log(`   Years detectados: ${yearsForTimeline.join(", ")}`);
  console.log(`   Observed years: ${annualSnapshots.length}`);
  console.log(
    `   Timeline: ${annualSnapshots
      .map((s) => s.ifs?.position)
      .reverse()
      .join(" → ")}`,
  );

  console.log("\n📌 Expected ifs_memory:");
  console.log(
    JSON.stringify(
      {
        window_years: 5,
        observed_years: annualSnapshots.length,
        timeline: annualSnapshots.map((s) => s.ifs?.position).reverse(),
      },
      null,
      2,
    ),
  );
}

debugAMZN().catch(console.error);
