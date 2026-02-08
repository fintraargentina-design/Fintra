import { supabaseAdmin } from "./lib/supabase-admin";
import { mapSnapshotToStockData } from "./components/dashboard/TablaIFS";

async function testIFSMapping() {
  console.log("🧪 Testing IFS Mapping in TablaIFS\n");
  console.log("=".repeat(70));

  // Fetch real snapshots
  const { data, error } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(3);

  if (error) {
    console.error("❌ Error fetching snapshots:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.warn("⚠️  No snapshots found");
    return;
  }

  console.log(`✅ Fetched ${data.length} snapshots\n`);

  // Map each one
  data.forEach((snapshot, i) => {
    console.log(`\n${i + 1}. Testing ${snapshot.ticker}:`);
    console.log("   Raw ifs (DB):", JSON.stringify(snapshot.ifs, null, 2));

    try {
      const mapped = mapSnapshotToStockData(snapshot);

      console.log("\n   Mapped ifs (UI):", JSON.stringify(mapped.ifs, null, 2));

      if (mapped.ifs) {
        console.log("   ✅ IFS mapped successfully:");
        console.log(`      Position: ${mapped.ifs.position}`);
        console.log(`      Pressure: ${mapped.ifs.pressure}`);
        console.log(`      Confidence: ${mapped.ifs.confidence}`);
      } else {
        console.log("   ❌ IFS is null - NOT mapped!");
      }

      if (mapped.ifs_fy) {
        console.log("   ✅ IFS FY exists:");
        console.log(
          `      Current FY: ${mapped.ifs_fy.current_fy.fiscal_year} - ${mapped.ifs_fy.current_fy.position}`,
        );
      } else {
        console.log("   ⚠️  IFS FY is null");
      }
    } catch (err: any) {
      console.error("   ❌ Mapping error:", err.message);
    }
  });

  console.log("\n" + "=".repeat(70));
  console.log("Test complete!\n");
}

testIFSMapping().catch(console.error);
