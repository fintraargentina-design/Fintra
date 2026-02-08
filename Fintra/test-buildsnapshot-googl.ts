import { supabaseAdmin } from "./lib/supabase-admin";
import { buildSnapshot } from "./app/api/cron/fmp-bulk/buildSnapshots";
import { fetchUniverseMap } from "./app/api/cron/fmp-bulk/fetchGrowthData";

async function testBuildSnapshot() {
  const ticker = "GOOGL.SW";
  const today = "2026-02-07";

  console.log(`🧪 TEST: buildSnapshot para ${ticker}\n`);
  console.log("========================================\n");

  // 1. Verificar universe data
  const { data: universeData } = await supabaseAdmin
    .from("fintra_universe")
    .select("ticker, sector, industry, name")
    .eq("ticker", ticker)
    .single();

  console.log("📊 FINTRA_UNIVERSE:");
  console.log(`   Ticker: ${universeData?.ticker}`);
  console.log(`   Sector: ${universeData?.sector}`);
  console.log(`   Industry: ${universeData?.industry}\n`);

  // 2. Cargar universeMap (como lo hace el cron)
  const universeMap = await fetchUniverseMap(supabaseAdmin);
  const universeRow = universeMap.get(ticker);

  console.log("📊 UNIVERSE MAP (en memoria):");
  console.log(`   Map size: ${universeMap.size} tickers`);
  console.log(`   ${ticker} in map: ${universeMap.has(ticker)}`);
  if (universeRow) {
    console.log(`   Sector from map: ${universeRow.sector}`);
    console.log(`   Industry from map: ${universeRow.industry}\n`);
  } else {
    console.log(`   ⚠️  ${ticker} NOT FOUND in map!\n`);
  }

  // 3. Verificar FMP profile
  const { data: profileData } = await supabaseAdmin
    .from("company_profile")
    .select("symbol, sector, industry, company_name")
    .eq("symbol", ticker)
    .maybeSingle();

  console.log("📊 FMP COMPANY_PROFILE:");
  if (profileData) {
    console.log(`   Symbol: ${profileData.symbol}`);
    console.log(`   Sector: ${profileData.sector || "NULL"}`);
    console.log(`   Industry: ${profileData.industry || "NULL"}\n`);
  } else {
    console.log(`   ⚠️  No profile found in DB\n`);
  }

  // 4. Verificar snapshot actual
  const { data: snapshot } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, sector, profile_structural, ifs")
    .eq("ticker", ticker)
    .eq("snapshot_date", today)
    .single();

  console.log("📊 FINTRA_SNAPSHOTS (estado actual):");
  console.log(`   Sector (flat): ${snapshot?.sector || "NULL"}`);
  console.log(
    `   profile_structural.sector: ${snapshot?.profile_structural?.sector || "NULL"}`,
  );
  console.log(`   IFS: ${snapshot?.ifs ? "EXISTS" : "NULL"}\n`);

  console.log("========================================\n");
  console.log("💡 DIAGNÓSTICO:\n");

  if (!universeMap.has(ticker)) {
    console.log("❌ PROBLEMA: Ticker NO está en universeMap");
    console.log("   Posible causa: Error al cargar fintra_universe");
  } else if (!universeRow?.sector) {
    console.log("❌ PROBLEMA: universeMap tiene el ticker pero sin sector");
    console.log("   Posible causa: sector es NULL en fintra_universe");
  } else if (snapshot?.sector === null) {
    console.log("❌ PROBLEMA: universeMap tiene sector pero snapshot NO");
    console.log(
      "   Posible causa: buildSnapshot no está usando universeMap correctamente",
    );
    console.log("   Necesita debugging en buildSnapshots.ts línea 260-277");
  } else {
    console.log("✅ Todo parece correcto en teoría");
    console.log("   Si IFS es NULL, revisar cálculo de performance relativa");
  }
}

testBuildSnapshot().catch(console.error);
