import { supabaseAdmin } from "./lib/supabase-admin";

async function checkScreenshotTickers() {
  const tickers = [
    "GOOGL.SW",
    "MIX.JO",
    "CRM.NE",
    "ADBE.SW",
    "CRM",
    "UBER",
    "FOO.F",
    "ADBE.NE",
    "N?.DE", // Este parece tener caracteres especiales
  ];

  console.log("🔍 VERIFICANDO TICKERS DEL SCREENSHOT\n");
  console.log("Buscando en fintra_snapshots (2026-02-07)...\n");

  for (const ticker of tickers) {
    const { data, error } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, ifs, fgos_score, profile_structural")
      .eq("ticker", ticker)
      .eq("snapshot_date", "2026-02-07")
      .single();

    if (error) {
      console.log(`❌ ${ticker}: No encontrado en DB`);
      continue;
    }

    const sector = data.profile_structural?.sector || "N/A";
    const hasIfs = data.ifs !== null;

    console.log(`\n📊 ${ticker}:`);
    console.log(`   Sector: ${sector}`);
    console.log(`   FGOS: ${data.fgos_score}`);
    console.log(`   IFS: ${hasIfs ? JSON.stringify(data.ifs) : "NULL ❌"}`);

    if (hasIfs) {
      console.log(
        `   ✅ Tiene IFS: ${data.ifs.position} (pressure: ${data.ifs.pressure})`,
      );
    } else {
      console.log(`   ⚠️ IFS es NULL en base de datos`);
    }
  }

  // Verificar si hay stocks de estos sectores con IFS
  console.log("\n\n🔍 VERIFICANDO COBERTURA POR SECTOR DE ESTOS STOCKS:\n");

  const { data: allData } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, ifs, profile_structural")
    .in("ticker", tickers)
    .eq("snapshot_date", "2026-02-07");

  const sectors = [
    ...new Set(
      allData?.map((d) => d.profile_structural?.sector).filter(Boolean),
    ),
  ];

  for (const sector of sectors) {
    const { count: total } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", "2026-02-07")
      .eq("profile_structural->>sector", sector);

    const { count: withIfs } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", "2026-02-07")
      .eq("profile_structural->>sector", sector)
      .not("ifs", "is", null);

    console.log(
      `📊 ${sector}: ${withIfs}/${total} tienen IFS (${((withIfs / total) * 100).toFixed(1)}%)`,
    );
  }
}

checkScreenshotTickers().catch(console.error);
