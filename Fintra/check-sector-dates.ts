import { supabaseAdmin } from "@/lib/supabase-admin";

async function main() {
  const { data } = await supabaseAdmin
    .from("sector_performance")
    .select("window_code, sector, performance_date")
    .eq("sector", "Technology")
    .order("performance_date", { ascending: false });

  console.log("📊 DATES Y WINDOWS PARA Technology:\n");

  const byDate: Record<string, string[]> = {};
  data?.forEach((d) => {
    if (!byDate[d.performance_date]) byDate[d.performance_date] = [];
    byDate[d.performance_date].push(d.window_code);
  });

  for (const [date, windows] of Object.entries(byDate)) {
    const sortedWindows = windows.sort();
    const has3M = windows.includes("3M");
    const has6M = windows.includes("6M");
    const has2Y = windows.includes("2Y");

    const missingIFS = [];
    if (!has3M) missingIFS.push("3M");
    if (!has6M) missingIFS.push("6M");
    if (!has2Y) missingIFS.push("2Y");

    const status =
      missingIFS.length === 0 ? "✅" : `❌ Faltan: ${missingIFS.join(", ")}`;

    console.log(`${date}: ${sortedWindows.join(", ")} ${status}`);
  }

  // Verificar exactamente qué fechas se usaron para snapshots recientes
  console.log("\n📋 SNAPSHOTS RECIENTES:");
  const { data: recentSnaps } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, snapshot_date")
    .eq("ticker", "GOOGL.SW")
    .order("snapshot_date", { ascending: false })
    .limit(5);

  console.log(
    "GOOGL.SW snapshots:",
    recentSnaps?.map((s) => s.snapshot_date),
  );
}

main().catch(console.error);
