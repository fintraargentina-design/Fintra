import { supabaseAdmin } from "./lib/supabase-admin";

async function checkSpecificTickers() {
  const tickers = ["0IL6.L", "AUD.DE", "ADSK", "AAPL", "TSLA"];

  console.log("🔍 Checking IFS data for specific tickers in DB:");
  console.log("=".repeat(70));

  for (const ticker of tickers) {
    const { data, error } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, snapshot_date, ifs, ifs_fy")
      .eq("ticker", ticker)
      .order("snapshot_date", { ascending: false })
      .limit(1);

    if (error) {
      console.error(`\n❌ Error fetching ${ticker}:`, error);
      continue;
    }

    if (!data || data.length === 0) {
      console.log(`\n⚠️  ${ticker}: No snapshot found`);
      continue;
    }

    const snap = data[0];
    console.log(`\n✅ ${ticker} (${snap.snapshot_date}):`);
    console.log(`   ifs:`, snap.ifs ? JSON.stringify(snap.ifs) : "NULL");
    console.log(`   ifs_fy:`, snap.ifs_fy ? "EXISTS" : "NULL");
  }

  console.log("\n" + "=".repeat(70));
}

checkSpecificTickers().catch(console.error);
