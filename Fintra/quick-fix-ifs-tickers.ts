import { supabaseAdmin } from "./lib/supabase-admin";
import { buildSnapshot } from "./app/api/cron/fmp-bulk/buildSnapshots";

async function quickFixIFSTickers() {
  // Tickers del screenshot que muestran "—" en UI
  const tickers = [
    "GOOGL.SW",
    "CRM",
    "UBER",
    "MIX.JO",
    "CRM.NE",
    "ADBE.SW",
    "FOO.F",
    "ADBE.NE",
  ];
  const today = "2026-02-07";

  console.log("🔧 QUICK FIX: Re-procesando tickers con IFS faltante\n");
  console.log(`Tickers: ${tickers.join(", ")}\n`);
  console.log("========================================\n");

  // 1. Cargar datos bulk necesarios (profiles, ratios, metrics, etc.)
  console.log("📥 Cargando datos FMP bulk...");

  const { data: profiles } = await supabaseAdmin
    .from("company_profile")
    .select("*")
    .in("symbol", tickers);

  const { data: ratios } = await supabaseAdmin
    .from("company_ratios")
    .select("*")
    .in("symbol", tickers);

  const { data: metrics } = await supabaseAdmin
    .from("company_metrics")
    .select("*")
    .in("symbol", tickers);

  const { data: scores } = await supabaseAdmin
    .from("company_scores")
    .select("*")
    .in("symbol", tickers);

  console.log(`   Profiles: ${profiles?.length || 0}`);
  console.log(`   Ratios: ${ratios?.length || 0}`);
  console.log(`   Metrics: ${metrics?.length || 0}`);
  console.log(`   Scores: ${scores?.length || 0}\n`);

  // 2. Cargar datos de crecimiento/performance
  console.log("📥 Cargando performance windows...");

  const { data: perfData } = await supabaseAdmin
    .from("performance_windows")
    .select("*")
    .in("ticker", tickers)
    .order("as_of_date", { ascending: false });

  console.log(`   Performance windows: ${perfData?.length || 0}\n`);

  // 3. Cargar universeMap (ahora corregido con todos los tickers)
  console.log("📥 Cargando universeMap (con fix de paginación)...");
  const { fetchUniverseMap, fetchIndustryPerformanceMap } =
    await import("./app/api/cron/fmp-bulk/fetchGrowthData");
  const universeMap = await fetchUniverseMap(supabaseAdmin);
  const industryPerfMap = await fetchIndustryPerformanceMap(supabaseAdmin);

  console.log("");

  // 4. Cargar sector performance
  console.log("📥 Cargando sector performance...");
  const { fetchSectorPerformanceHistory } =
    await import("./app/api/cron/fmp-bulk/fetchGrowthData");
  const sectorPerfMap = await fetchSectorPerformanceHistory(supabaseAdmin);
  console.log(`   Sectors loaded: ${sectorPerfMap.size}\n`);

  // 5. Re-procesar cada ticker
  console.log("🔨 RE-PROCESANDO SNAPSHOTS:\n");
  console.log("========================================\n");

  const results = [];

  for (const ticker of tickers) {
    try {
      console.log(`\n📊 ${ticker}:`);

      // Verificar si está en universeMap
      const universeRow = universeMap.get(ticker);
      if (!universeRow) {
        console.log(`   ⚠️  No encontrado en fintra_universe, saltando...`);
        results.push({ ticker, status: "skipped", reason: "not_in_universe" });
        continue;
      }

      console.log(
        `   ✅ Universe: sector=${universeRow.sector}, industry=${universeRow.industry}`,
      );

      // Buscar data FMP
      const profile = profiles?.find((p) => p.symbol === ticker);
      const ratio = ratios?.find((r) => r.symbol === ticker);
      const metric = metrics?.find((m) => m.symbol === ticker);
      const score = scores?.find((s) => s.symbol === ticker);

      if (!profile) {
        console.log(
          `   ⚠️  No profile data en FMP bulk, puede tener datos limitados`,
        );
      }

      // Preparar performance data
      const tickerPerfData = perfData?.filter((p) => p.ticker === ticker) || [];
      console.log(`   Performance windows: ${tickerPerfData.length} rows`);

      // Llamar buildSnapshot (simulando)
      // NOTA: buildSnapshot requiere muchos parámetros, haríamos un proceso simplificado
      console.log(`   ⚠️  buildSnapshot requiere ejecución completa del cron`);
      console.log(
        `   💡 Solución: Ejecutar cron con estos tickers específicos`,
      );

      results.push({ ticker, status: "ready", universeRow });
    } catch (error) {
      console.error(`   ❌ Error procesando ${ticker}:`, error);
      results.push({ ticker, status: "error", error: String(error) });
    }
  }

  // 6. Mostrar resumen
  console.log("\n\n========================================\n");
  console.log("📊 RESUMEN:\n");

  const ready = results.filter((r) => r.status === "ready");
  const skipped = results.filter((r) => r.status === "skipped");
  const errors = results.filter((r) => r.status === "error");

  console.log(`✅ Listos para re-procesar: ${ready.length}`);
  console.log(`⚠️  Saltados: ${skipped.length}`);
  console.log(`❌ Errores: ${errors.length}\n`);

  if (ready.length > 0) {
    console.log("💡 PRÓXIMO PASO:");
    console.log(`   Ejecutar cron con estos tickers:`);
    console.log(
      `   npx tsx scripts/pipeline/16-fmp-bulk-snapshots.ts ${ready.map((r) => r.ticker).join(",")}\n`,
    );
  }

  // Verificar que universeMap ahora tiene TODOS los tickers
  console.log("🔍 VERIFICACIÓN FINAL:\n");
  for (const ticker of tickers) {
    const inMap = universeMap.has(ticker);
    const sector = universeMap.get(ticker)?.sector;
    console.log(
      `   ${inMap ? "✅" : "❌"} ${ticker.padEnd(12)} → ${sector || "NO SECTOR"}`,
    );
  }
}

quickFixIFSTickers().catch(console.error);
