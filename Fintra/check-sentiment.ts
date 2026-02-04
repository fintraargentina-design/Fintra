import { supabaseAdmin } from "./lib/supabase-admin";

async function checkSentiment() {
  console.log("🔍 Checking Sentiment in fintra_snapshots...\n");

  // Get latest snapshot date
  const { data: dateData, error: dateError } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (dateError) {
    console.error("Error getting latest date:", dateError);
    return;
  }

  const latestDate = dateData.snapshot_date;
  console.log(`📅 Latest snapshot date: ${latestDate}\n`);

  // Query sentiment stats
  const { data: allSnapshots, error } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, fgos_breakdown")
    .eq("snapshot_date", latestDate);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`📊 Total snapshots on ${latestDate}: ${allSnapshots.length}\n`);

  let sentimentNull = 0;
  let sentimentNotNull = 0;
  let sentimentUndefined = 0;
  let fgosBreakdownNull = 0;

  const examplesWithSentiment: any[] = [];
  const examplesWithoutSentiment: any[] = [];

  allSnapshots.forEach((snap) => {
    if (!snap.fgos_breakdown) {
      fgosBreakdownNull++;
      return;
    }

    const sentiment = snap.fgos_breakdown.sentiment;

    if (sentiment === undefined) {
      sentimentUndefined++;
      if (examplesWithoutSentiment.length < 5) {
        examplesWithoutSentiment.push({
          ticker: snap.ticker,
          sentiment: "undefined",
          breakdown: snap.fgos_breakdown,
        });
      }
    } else if (sentiment === null) {
      sentimentNull++;
      if (examplesWithoutSentiment.length < 5) {
        examplesWithoutSentiment.push({
          ticker: snap.ticker,
          sentiment: "null",
          breakdown: snap.fgos_breakdown,
        });
      }
    } else {
      sentimentNotNull++;
      if (examplesWithSentiment.length < 5) {
        examplesWithSentiment.push({
          ticker: snap.ticker,
          sentiment,
          band: snap.fgos_breakdown.sentiment_details?.band,
          confidence: snap.fgos_breakdown.sentiment_details?.confidence,
        });
      }
    }
  });

  console.log("═══════════════════════════════════════════════════════════");
  console.log("SENTIMENT STATISTICS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Total snapshots:           ${allSnapshots.length}`);
  console.log(`fgos_breakdown is null:    ${fgosBreakdownNull}`);
  console.log(`sentiment = undefined:     ${sentimentUndefined}`);
  console.log(`sentiment = null:          ${sentimentNull}`);
  console.log(`sentiment = number:        ${sentimentNotNull}`);
  console.log("───────────────────────────────────────────────────────────");

  const totalWithBreakdown = allSnapshots.length - fgosBreakdownNull;
  const percentNull =
    totalWithBreakdown > 0
      ? (
          ((sentimentNull + sentimentUndefined) / totalWithBreakdown) *
          100
        ).toFixed(2)
      : 0;
  const percentNotNull =
    totalWithBreakdown > 0
      ? ((sentimentNotNull / totalWithBreakdown) * 100).toFixed(2)
      : 0;

  console.log(`% with sentiment = null:   ${percentNull}%`);
  console.log(`% with sentiment value:    ${percentNotNull}%`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (examplesWithSentiment.length > 0) {
    console.log("✅ Examples WITH sentiment (first 5):");
    examplesWithSentiment.forEach((ex, i) => {
      console.log(
        `  ${i + 1}. ${ex.ticker}: sentiment=${ex.sentiment}, band=${ex.band}, confidence=${ex.confidence}`,
      );
    });
    console.log("");
  }

  if (examplesWithoutSentiment.length > 0) {
    console.log("❌ Examples WITHOUT sentiment (first 5):");
    examplesWithoutSentiment.forEach((ex, i) => {
      console.log(`  ${i + 1}. ${ex.ticker}: sentiment=${ex.sentiment}`);
      console.log(
        `     fgos_breakdown keys: ${Object.keys(ex.breakdown || {}).join(", ")}`,
      );
    });
    console.log("");
  }

  // Check if sentiment_details exists
  const withSentimentDetails = allSnapshots.filter(
    (s) => s.fgos_breakdown?.sentiment_details !== undefined,
  ).length;

  console.log("───────────────────────────────────────────────────────────");
  console.log(`Snapshots with sentiment_details: ${withSentimentDetails}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

checkSentiment().catch(console.error);
