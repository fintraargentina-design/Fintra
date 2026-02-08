import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  console.log("📊 VERIFICANDO COBERTURA DE prices_daily...\n");

  // First check if table has any data
  const { count: totalCount, error: countError } = await supabaseAdmin
    .from("prices_daily")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("❌ Error querying table:", countError.message);
    return;
  }

  if (!totalCount || totalCount === 0) {
    console.error("❌ Tabla prices_daily está vacía");
    return;
  }

  console.log(`✅ Tabla tiene ${totalCount.toLocaleString()} registros\n`);

  // Get date range
  const { data: dates, error: dateError } = await supabaseAdmin
    .from("prices_daily")
    .select("price_date")
    .order("price_date", { ascending: true })
    .limit(1);

  const { data: maxDate, error: maxError } = await supabaseAdmin
    .from("prices_daily")
    .select("price_date")
    .order("price_date", { ascending: false })
    .limit(1);

  if (
    dateError ||
    maxError ||
    !dates ||
    !maxDate ||
    dates.length === 0 ||
    maxDate.length === 0
  ) {
    console.error(
      "❌ Error fetching dates:",
      dateError?.message || maxError?.message,
    );
    return;
  }

  const firstDate = dates[0]?.price_date;
  const lastDate = maxDate[0]?.price_date;

  console.log("📅 Rango de fechas:");
  console.log(`   Primera: ${firstDate}`);
  console.log(`   Última:  ${lastDate}`);

  // Count distinct dates
  const { data: distinctDates, error: distinctError } = await supabaseAdmin
    .from("prices_daily")
    .select("price_date", { count: "exact" })
    .order("price_date", { ascending: false });

  if (distinctDates) {
    const uniqueDates = new Set(distinctDates.map((d) => d.price_date));
    console.log(`\n📊 Días con datos: ${uniqueDates.size}`);

    // Calculate days needed for IFS
    const daysNeeded = {
      "3M": 90,
      "6M": 180,
      "2Y": 730,
    };

    console.log("\n✅ Suficiente para:");
    if (uniqueDates.size >= daysNeeded["3M"]) {
      console.log("   ✅ 3M window (requiere 90 días)");
    } else {
      console.log(
        `   ❌ 3M window (requiere 90 días, tenemos ${uniqueDates.size})`,
      );
    }

    if (uniqueDates.size >= daysNeeded["6M"]) {
      console.log("   ✅ 6M window (requiere 180 días)");
    } else {
      console.log(
        `   ❌ 6M window (requiere 180 días, tenemos ${uniqueDates.size})`,
      );
    }

    if (uniqueDates.size >= daysNeeded["2Y"]) {
      console.log("   ✅ 2Y window (requiere 730 días)");
    } else {
      console.log(
        `   ❌ 2Y window (requiere 730 días, tenemos ${uniqueDates.size})`,
      );
    }
  }

  // Show recent dates
  const { data: recent } = await supabaseAdmin
    .from("prices_daily")
    .select("price_date")
    .order("price_date", { ascending: false })
    .limit(10);

  console.log("\n📅 Últimas 10 fechas:");
  recent?.forEach((r) => console.log(`   - ${r.price_date}`));

  // Count total rows
  const { count: totalRows } = await supabaseAdmin
    .from("prices_daily")
    .select("*", { count: "exact", head: true });

  console.log(`\n📦 Total de registros: ${totalRows?.toLocaleString()}`);

  // Sample ticker check
  const { data: sampleTicker } = await supabaseAdmin
    .from("prices_daily")
    .select("price_date")
    .eq("ticker", "AAPL")
    .order("price_date", { ascending: false })
    .limit(5);

  console.log("\n🔍 Ejemplo AAPL (últimos 5 días):");
  sampleTicker?.forEach((r) => console.log(`   - ${r.price_date}`));
}

main().catch(console.error);
