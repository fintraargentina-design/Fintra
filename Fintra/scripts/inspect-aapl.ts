// Inspect AAPL snapshot structure
import { loadEnv } from "./utils/load-env";
loadEnv();

import { supabaseAdmin } from "@/lib/supabase-admin";

async function inspectStructure() {
  const { data } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, snapshot_date, ifs, ifs_memory")
    .eq("ticker", "AAPL")
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    console.log("❌ AAPL not found");
    return;
  }

  console.log("📊 AAPL IFS & IFS Memory:\n");
  console.log("Ticker:", data.ticker);
  console.log("Date:", data.snapshot_date);

  console.log("\nIFS:");
  console.log(JSON.stringify(data.ifs, null, 2));

  console.log("\n\nIFS Memory:");
  console.log(JSON.stringify(data.ifs_memory, null, 2));

  // Check if timeline exists
  if (data.ifs_memory?.timeline) {
    console.log("\n✅ Timeline EXISTS:", data.ifs_memory.timeline);
  } else {
    console.log("\n❌ Timeline is MISSING or NULL");
  }
}

inspectStructure().catch(console.error);
