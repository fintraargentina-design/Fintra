// Verify IFS timeline chronology
import { loadEnv } from "./utils/load-env";
loadEnv();

import { supabaseAdmin } from "@/lib/supabase-admin";

async function verifyTimeline() {
  const { data, error } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, ifs_memory")
    .not("ifs_memory", "is", null)
    .in("ticker", [
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
    ])
    .order("ticker", { ascending: true })
    .limit(10);

  if (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  console.log("🔍 Verificando cronología de timeline IFS:\n");

  let validCount = 0;
  let missingCount = 0;

  for (const row of data || []) {
    const timeline = row.ifs_memory?.timeline;
    const observedYears = row.ifs_memory?.observed_years;

    if (timeline && timeline.length > 0) {
      console.log(
        `✅ ${row.ticker.padEnd(6)}: ${timeline.join(" → ")} (${observedYears} años)`,
      );
      validCount++;
    } else {
      console.log(`❌ ${row.ticker.padEnd(6)}: Timeline MISSING`);
      missingCount++;
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`   Timeline válido: ${validCount}/10`);
  console.log(`   Timeline faltante: ${missingCount}/10`);

  if (validCount === 10) {
    console.log(
      "\n✅ TODOS LOS TICKERS TIENEN TIMELINE - Pipeline funcionando correctamente",
    );
  } else if (validCount > 0) {
    console.log("\n⚠️ TIMELINE PARCIAL - Algunos tickers sin datos");
  } else {
    console.log("\n❌ PIPELINE BROKEN - Ningún ticker tiene timeline");
  }
}

verifyTimeline().catch(console.error);
