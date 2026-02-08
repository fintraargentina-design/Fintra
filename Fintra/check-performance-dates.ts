import { supabaseAdmin } from "./lib/supabase-admin";

async function checkPerformanceDates() {
  const tickers = ["GOOGL.SW", "CRM", "UBER", "GOOGL", "AAPL"];

  console.log("🔍 VERIFICANDO AS_OF_DATE en PERFORMANCE_WINDOWS:\n");

  for (const ticker of tickers) {
    console.log(`\n📊 ${ticker}:`);

    const { data } = await supabaseAdmin
      .from("performance_windows")
      .select("window_code, as_of_date, asset_return, benchmark_return")
      .eq("ticker", ticker)
      .order("as_of_date", { ascending: false })
      .limit(10);

    if (!data || data.length === 0) {
      console.log("   ❌ No data");
      continue;
    }

    // Group by as_of_date
    const dateGroups = new Map<string, any[]>();
    data.forEach((row) => {
      if (!dateGroups.has(row.as_of_date)) {
        dateGroups.set(row.as_of_date, []);
      }
      dateGroups.get(row.as_of_date)!.push(row);
    });

    console.log(`   Total rows: ${data.length}`);
    console.log(`   Latest as_of_date: ${data[0].as_of_date}`);
    console.log(`   Unique dates: ${dateGroups.size}`);

    // Mostrar windows disponibles para la fecha más reciente
    const latestDate = data[0].as_of_date;
    const latestWindows = data.filter((d) => d.as_of_date === latestDate);
    const windowCodes = latestWindows.map((w) => w.window_code).sort();
    console.log(`   Windows for ${latestDate}: [${windowCodes.join(", ")}]`);

    // Verificar si tiene los 7 windows requeridos: 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y
    const requiredWindows = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y"];
    const missingWindows = requiredWindows.filter(
      (w) => !windowCodes.includes(w),
    );

    if (missingWindows.length > 0) {
      console.log(`   ⚠️  Missing windows: [${missingWindows.join(", ")}]`);
    } else {
      console.log(`   ✅ All 7 windows present`);
    }

    // Verificar si snapshot tiene IFS
    const { data: snap } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ifs")
      .eq("ticker", ticker)
      .eq("snapshot_date", "2026-02-07")
      .single();

    console.log(`   IFS en snapshot: ${snap?.ifs ? "✅ EXISTS" : "❌ NULL"}`);
  }

  // Verificar si PROFILE_STRUCTURAL tiene sector
  console.log("\n\n🔍 VERIFICANDO SECTOR EN PROFILE_STRUCTURAL:\n");

  for (const ticker of tickers) {
    const { data } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, profile_structural")
      .eq("ticker", ticker)
      .eq("snapshot_date", "2026-02-07")
      .single();

    const sector = data?.profile_structural?.sector;
    console.log(`${ticker.padEnd(12)} → Sector: ${sector || "NULL"}`);
  }
}

checkPerformanceDates().catch(console.error);
