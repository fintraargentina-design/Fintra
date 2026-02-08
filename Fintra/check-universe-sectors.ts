import { supabaseAdmin } from "./lib/supabase-admin";

async function checkUniverseData() {
  const tickers = [
    "GOOGL.SW",
    "CRM",
    "UBER",
    "GOOGL",
    "AAPL",
    "MIX.JO",
    "CRM.NE",
    "ADBE.SW",
    "FOO.F",
  ];

  console.log("🔍 VERIFICANDO FINTRA_UNIVERSE:\n");
  console.log("Explicación: IFS requiere sector de una de estas dos fuentes:");
  console.log("  1. fintra_universe.sector (PRIORIDAD 1 - CANONICAL)");
  console.log("  2. FMP company_profile.sector (PRIORIDAD 2 - FALLBACK)\n");
  console.log("========================================\n");

  for (const ticker of tickers) {
    const { data, error } = await supabaseAdmin
      .from("fintra_universe")
      .select("ticker, sector, industry, name, is_active")
      .eq("ticker", ticker)
      .maybeSingle();

    if (!data) {
      console.log(`[X] ${ticker.padEnd(12)} -> NO EXISTE en fintra_universe`);
    } else {
      const hasSector = data.sector !== null && data.sector !== undefined;
      const symbol = hasSector ? "[OK]" : "[!!]";
      console.log(
        `${symbol} ${ticker.padEnd(12)} -> Sector: ${(data.sector || "NULL").padEnd(25)} | Active: ${data.is_active}`,
      );
    }
  }

  // Verificar cuántos en total no tienen sector
  console.log("\n\n📊 ESTADÍSTICAS GENERALES:\n");

  const { count: totalActive } = await supabaseAdmin
    .from("fintra_universe")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  const { count: activeWithSector } = await supabaseAdmin
    .from("fintra_universe")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .not("sector", "is", null);

  const { count: activeWithoutSector } = await supabaseAdmin
    .from("fintra_universe")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .filter("sector", "is", null);

  console.log(`Total tickers activos: ${totalActive}`);
  console.log(
    `Con sector: ${activeWithSector} (${((activeWithSector / totalActive) * 100).toFixed(1)}%)`,
  );
  console.log(
    `Sin sector: ${activeWithoutSector} (${((activeWithoutSector / totalActive) * 100).toFixed(1)}%)`,
  );

  // Verificar relación con IFS
  console.log("\n\n📊 RELACIÓN FINTRA_UNIVERSE.SECTOR vs IFS:\n");

  const today = "2026-02-07";

  // Tickers sin sector en universe
  const { data: tickersWithoutSector } = await supabaseAdmin
    .from("fintra_universe")
    .select("ticker")
    .eq("is_active", true)
    .filter("sector", "is", null)
    .limit(1000);

  const tickerList = tickersWithoutSector?.map((t) => t.ticker) || [];

  if (tickerList.length > 0) {
    const { count: snapshotsWithIFS } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("*", { count: "exact", head: true })
      .eq("snapshot_date", today)
      .in("ticker", tickerList)
      .not("ifs", "is", null);

    console.log(
      `Tickers SIN sector en universe (sample de ${tickerList.length})`,
    );
    console.log(`  -> Con IFS en snapshot: ${snapshotsWithIFS}`);
    console.log(
      `  -> Esto significa que obtuvieron sector del fallback (FMP profile)`,
    );
  }
}

checkUniverseData().catch(console.error);
