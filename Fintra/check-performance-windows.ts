import { supabaseAdmin } from "./lib/supabase-admin";

async function checkPerformanceWindows() {
  const tickers = ["GOOGL.SW", "CRM", "UBER", "GOOGL", "AAPL", "TSLA"];

  console.log("🔍 VERIFICANDO PERFORMANCE_WINDOWS:\n");
  console.log(
    "IFS requiere datos de esta tabla para calcular performance relativa vs sector\n",
  );

  for (const ticker of tickers) {
    const { count, error } = await supabaseAdmin
      .from("performance_windows")
      .select("*", { count: "exact", head: true })
      .eq("ticker", ticker);

    if (error) {
      console.log(`❌ ${ticker}: Error - ${error.message}`);
      continue;
    }

    const hasData = (count || 0) > 0;

    console.log(
      `${hasData ? "✅" : "❌"} ${ticker.padEnd(12)} → ${count || 0} rows`,
    );

    // Si tiene datos, mostrar sample
    if (hasData) {
      const { data: sample } = await supabaseAdmin
        .from("performance_windows")
        .select("window_code, asset_return, benchmark_return, as_of_date")
        .eq("ticker", ticker)
        .order("as_of_date", { ascending: false })
        .limit(3);

      console.log(`   Sample (últimos 3 windows):`);
      sample?.forEach((w) => {
        const relative = w.asset_return - w.benchmark_return;
        console.log(
          `      ${w.window_code}: Asset ${w.asset_return.toFixed(2)}% - Bench ${w.benchmark_return.toFixed(2)}% = Relative ${relative.toFixed(2)}%`,
        );
      });
    }
  }

  // Comparar cantidades
  console.log("\n\n📊 COMPARACIÓN CANTIDAD DE DATOS:\n");

  for (const ticker of tickers) {
    const { count } = await supabaseAdmin
      .from("performance_windows")
      .select("*", { count: "exact", head: true })
      .eq("ticker", ticker);

    const { data: ifs } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ifs")
      .eq("ticker", ticker)
      .eq("snapshot_date", "2026-02-07")
      .single();

    const hasIfs = ifs?.ifs !== null;

    console.log(
      `${ticker.padEnd(12)} → Perf Windows: ${String(count || 0).padStart(3)} rows | IFS: ${hasIfs ? "✅ EXISTS" : "❌ NULL"}`,
    );
  }
}

checkPerformanceWindows().catch(console.error);
