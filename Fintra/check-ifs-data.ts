import { supabaseAdmin } from "./lib/supabase-admin";

async function checkIFSData() {
  const { data, error } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, ifs, ifs_fy")
    .order("snapshot_date", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("📊 IFS JSONB structure in fintra_snapshots:");
  console.log("=".repeat(70));

  data?.forEach((s, i) => {
    console.log(`\n${i + 1}. ${s.ticker}:`);
    console.log("   ifs:", JSON.stringify(s.ifs, null, 2));
    console.log("   ifs_fy:", JSON.stringify(s.ifs_fy, null, 2));
  });
}

checkIFSData().catch(console.error);
