// Audit fintra_snapshots for IFS and table population data
import { loadEnv } from "./utils/load-env";
loadEnv();

import { supabaseAdmin } from "@/lib/supabase-admin";

async function auditSnapshots() {
  console.log("🔍 Auditing fintra_snapshots for IFS and table data...\n");

  // 1. Get latest snapshot date
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

  console.log(`📅 Latest snapshot date: ${latestDate.snapshot_date}\n`);

  // 2. Sample 10 tickers
  const { data: samples, error } = await supabaseAdmin
    .from("fintra_snapshots")
    .select(
      `
      ticker,
      snapshot_date,
      sector,
      fgos_score,
      fgos_category,
      fgos_confidence_percent,
      ifs,
      market_snapshot,
      profile_structural,
      relative_vs_sector_1m,
      relative_vs_sector_3m,
      relative_vs_sector_1y,
      relative_vs_market_1m
    `,
    )
    .eq("snapshot_date", latestDate.snapshot_date)
    .not("sector", "is", null)
    .limit(10);

  if (error) {
    console.error("❌ Query error:", error);
    return;
  }

  if (!samples || samples.length === 0) {
    console.error("❌ No data found for latest snapshot date");
    return;
  }

  console.log(`📊 Analyzing ${samples.length} sample tickers:\n`);

  // 3. Analyze each ticker
  let hasIFS = 0;
  let hasFGOS = 0;
  let hasMarketSnapshot = 0;
  let hasRelativePerf = 0;
  let hasProfile = 0;

  samples.forEach((snap) => {
    const ifsData = snap.ifs;
    const hasIFSData =
      ifsData &&
      typeof ifsData === "object" &&
      ("position" in ifsData || "pressure" in ifsData);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Ticker: ${snap.ticker} (${snap.sector})`);
    console.log(`${"=".repeat(60)}`);

    // IFS
    console.log(`\n🎯 IFS Data:`);
    if (hasIFSData) {
      console.log(`  ✅ IFS exists`);
      console.log(`     Position: ${ifsData.position || "null"}`);
      console.log(`     Pressure: ${ifsData.pressure || "null"}`);
      console.log(`     Status: ${ifsData.status || "null"}`);
      hasIFS++;
    } else {
      console.log(`  ❌ IFS missing or empty:`, JSON.stringify(ifsData));
    }

    // FGOS
    console.log(`\n📈 FGOS Data:`);
    if (snap.fgos_score !== null) {
      console.log(`  ✅ FGOS Score: ${snap.fgos_score}`);
      console.log(`     Category: ${snap.fgos_category || "null"}`);
      console.log(
        `     Confidence: ${snap.fgos_confidence_percent || "null"}%`,
      );
      hasFGOS++;
    } else {
      console.log(`  ❌ FGOS missing`);
    }

    // Market Snapshot
    console.log(`\n💹 Market Data:`);
    if (snap.market_snapshot && typeof snap.market_snapshot === "object") {
      const ms = snap.market_snapshot as any;
      console.log(`  ✅ Market snapshot exists`);
      console.log(`     Price: $${ms.price || "null"}`);
      console.log(`     Change: ${ms.change_percent || "null"}%`);
      hasMarketSnapshot++;
    } else {
      console.log(`  ❌ Market snapshot missing`);
    }

    // Relative Performance
    console.log(`\n📊 Relative Performance:`);
    const hasAnyRelPerf =
      snap.relative_vs_sector_1m !== null ||
      snap.relative_vs_sector_3m !== null ||
      snap.relative_vs_sector_1y !== null;
    if (hasAnyRelPerf) {
      console.log(`  ✅ Relative performance exists`);
      console.log(
        `     vs Sector 1M: ${snap.relative_vs_sector_1m?.toFixed(2) || "null"}%`,
      );
      console.log(
        `     vs Sector 3M: ${snap.relative_vs_sector_3m?.toFixed(2) || "null"}%`,
      );
      console.log(
        `     vs Sector 1Y: ${snap.relative_vs_sector_1y?.toFixed(2) || "null"}%`,
      );
      console.log(
        `     vs Market 1M: ${snap.relative_vs_market_1m?.toFixed(2) || "null"}%`,
      );
      hasRelativePerf++;
    } else {
      console.log(`  ❌ Relative performance missing`);
    }

    // Profile
    console.log(`\n🏢 Company Profile:`);
    if (
      snap.profile_structural &&
      typeof snap.profile_structural === "object"
    ) {
      const profile = snap.profile_structural as any;
      console.log(`  ✅ Profile exists`);
      console.log(`     Name: ${profile.name || "null"}`);
      console.log(
        `     Market Cap: $${profile.market_cap?.toLocaleString() || "null"}`,
      );
      hasProfile++;
    } else {
      console.log(`  ❌ Profile missing`);
    }
  });

  // Summary
  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`📊 SUMMARY (${samples.length} tickers)`);
  console.log(`${"=".repeat(60)}`);
  console.log(
    `IFS Data:              ${hasIFS}/${samples.length} (${((hasIFS / samples.length) * 100).toFixed(0)}%)`,
  );
  console.log(
    `FGOS Score:            ${hasFGOS}/${samples.length} (${((hasFGOS / samples.length) * 100).toFixed(0)}%)`,
  );
  console.log(
    `Market Snapshot:       ${hasMarketSnapshot}/${samples.length} (${((hasMarketSnapshot / samples.length) * 100).toFixed(0)}%)`,
  );
  console.log(
    `Relative Performance:  ${hasRelativePerf}/${samples.length} (${((hasRelativePerf / samples.length) * 100).toFixed(0)}%)`,
  );
  console.log(
    `Company Profile:       ${hasProfile}/${samples.length} (${((hasProfile / samples.length) * 100).toFixed(0)}%)`,
  );

  // Check what TablaIFS needs
  console.log(`\n\n${"=".repeat(60)}`);
  console.log(`📋 TABLA IFS REQUIREMENTS`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Required fields for TablaIFS component:`);
  console.log(`  • ticker              ✅ Always present`);
  console.log(
    `  • name                ${hasProfile === samples.length ? "✅" : "⚠️"} (${hasProfile}/${samples.length})`,
  );
  console.log(`  • sector              ✅ Filtered by sector`);
  console.log(
    `  • ifs.position        ${hasIFS === samples.length ? "✅" : "❌"} (${hasIFS}/${samples.length})`,
  );
  console.log(
    `  • ifs.pressure        ${hasIFS === samples.length ? "✅" : "❌"} (${hasIFS}/${samples.length})`,
  );
  console.log(
    `  • fgos_score          ${hasFGOS === samples.length ? "✅" : "⚠️"} (${hasFGOS}/${samples.length})`,
  );
  console.log(
    `  • relative_vs_sector  ${hasRelativePerf === samples.length ? "✅" : "⚠️"} (${hasRelativePerf}/${samples.length})`,
  );
  console.log(
    `  • market_snapshot     ${hasMarketSnapshot === samples.length ? "✅" : "⚠️"} (${hasMarketSnapshot}/${samples.length})`,
  );

  if (hasIFS < samples.length) {
    console.log(
      `\n⚠️ WARNING: IFS data is missing for ${samples.length - hasIFS} tickers!`,
    );
    console.log(`   This will cause the table to show empty cells.`);
    console.log(`   Run IFS calculator to populate missing data.`);
  }

  if (hasIFS === 0) {
    console.log(`\n❌ CRITICAL: No IFS data found at all!`);
    console.log(`   The IFS calculator may not have run yet.`);
    console.log(`   Run: pnpm tsx scripts/pipeline/18-recompute-fgos-all.ts`);
  }
}

auditSnapshots().catch(console.error);
