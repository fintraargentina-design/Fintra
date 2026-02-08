import { supabaseAdmin } from "./lib/supabase-admin";

async function checkProfiles() {
  const tickers = ["GOOGL.SW", "CRM", "UBER", "GOOGL", "ADBE"];

  console.log("🔍 VERIFICANDO PROFILE_STRUCTURAL:\n");

  for (const ticker of tickers) {
    const { data, error } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, profile_structural, fgos_score")
      .eq("ticker", ticker)
      .eq("snapshot_date", "2026-02-07")
      .single();

    if (error) {
      console.log(`❌ ${ticker}: No encontrado`);
      continue;
    }

    const ps = data.profile_structural;

    console.log(`\n📊 ${ticker}:`);
    console.log(`   FGOS: ${data.fgos_score}`);
    console.log(`   Has profile_structural: ${!!ps}`);

    if (ps) {
      console.log(`   Sector: ${ps.sector || "NULL"}`);
      console.log(`   Industry: ${ps.industry || "NULL"}`);
      console.log(`   Country: ${ps.country || "NULL"}`);
      console.log(`   Exchange: ${ps.exchange || "NULL"}`);
    } else {
      console.log(`   ⚠️ profile_structural es NULL`);
    }
  }

  // Comparar con versión US
  console.log("\n\n🔍 COMPARANDO VERSIONES US vs EXTRANJERAS:\n");

  const pairs = [
    ["GOOGL", "GOOGL.SW"],
    ["ADBE", "ADBE.SW"],
    ["CRM", "CRM.NE"],
  ];

  for (const [us, foreign] of pairs) {
    const { data: usData } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, profile_structural->sector, ifs")
      .eq("ticker", us)
      .eq("snapshot_date", "2026-02-07")
      .single();

    const { data: foreignData } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, profile_structural->sector, ifs")
      .eq("ticker", foreign)
      .eq("snapshot_date", "2026-02-07")
      .maybeSingle();

    console.log(`${us} (US):`);
    console.log(`   Sector: ${usData?.sector || "NULL"}`);
    console.log(`   IFS: ${usData?.ifs ? "EXISTS" : "NULL"}`);

    console.log(`${foreign} (Foreign):`);
    console.log(`   Sector: ${foreignData?.sector || "NULL"}`);
    console.log(`   IFS: ${foreignData?.ifs ? "EXISTS" : "NULL"}`);
    console.log("");
  }
}

checkProfiles().catch(console.error);
