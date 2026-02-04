// Check specific US tickers for IFS data
import { loadEnv } from "./utils/load-env";
loadEnv();

import { supabaseAdmin } from "@/lib/supabase-admin";

async function checkUSTickers() {
  const usTickers = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "NVDA",
    "META",
    "JPM",
    "BAC",
    "WMT",
  ];

  console.log("🔍 Checking US tickers for IFS data...\n");

  const { data: latestDate } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (!latestDate) {
    console.error("❌ No snapshots found");
    return;
  }

  console.log(`📅 Latest snapshot: ${latestDate.snapshot_date}\n`);

  const { data: snapshots } = await supabaseAdmin
    .from("fintra_snapshots")
    .select(
      `
      ticker,
      sector,
      ifs,
      fgos_score,
      relative_vs_sector_1m,
      profile_structural
    `,
    )
    .in("ticker", usTickers)
    .eq("snapshot_date", latestDate.snapshot_date);

  if (!snapshots || snapshots.length === 0) {
    console.log("❌ No US tickers found in snapshots\n");

    // Check if they exist at all
    const { data: anySnapshot } = await supabaseAdmin
      .from("fintra_snapshots")
      .select("ticker, snapshot_date")
      .in("ticker", usTickers)
      .limit(5);

    if (anySnapshot && anySnapshot.length > 0) {
      console.log("⚠️ US tickers exist in older snapshots:");
      anySnapshot.forEach((s) => {
        console.log(`   ${s.ticker}: ${s.snapshot_date}`);
      });
    }
    return;
  }

  console.log(`Found ${snapshots.length}/${usTickers.length} US tickers\n`);

  snapshots.forEach((snap) => {
    const hasIFS =
      snap.ifs && typeof snap.ifs === "object" && "position" in snap.ifs;
    const name = snap.profile_structural?.name || "N/A";

    console.log(
      `${snap.ticker.padEnd(6)} | ${name.substring(0, 30).padEnd(30)} | IFS: ${hasIFS ? "✅" : "❌"} ${hasIFS ? `(${snap.ifs.position}, P${snap.ifs.pressure})` : ""} | FGOS: ${snap.fgos_score || "N/A"} | RelPerf: ${snap.relative_vs_sector_1m !== null ? "✅" : "❌"}`,
    );
  });

  const withIFS = snapshots.filter((s) => s.ifs && "position" in s.ifs).length;
  const withRelPerf = snapshots.filter(
    (s) => s.relative_vs_sector_1m !== null,
  ).length;

  console.log(`\n📊 Coverage:`);
  console.log(
    `   IFS: ${withIFS}/${snapshots.length} (${((withIFS / snapshots.length) * 100).toFixed(0)}%)`,
  );
  console.log(
    `   Relative Performance: ${withRelPerf}/${snapshots.length} (${((withRelPerf / snapshots.length) * 100).toFixed(0)}%)`,
  );

  if (withIFS < snapshots.length) {
    console.log(
      `\n⚠️ Missing IFS for: ${snapshots
        .filter((s) => !s.ifs || !("position" in s.ifs))
        .map((s) => s.ticker)
        .join(", ")}`,
    );
  }

  if (withRelPerf < snapshots.length) {
    console.log(
      `⚠️ Missing RelPerf for: ${snapshots
        .filter((s) => s.relative_vs_sector_1m === null)
        .map((s) => s.ticker)
        .join(", ")}`,
    );
  }
}

checkUSTickers().catch(console.error);
