import { fetchSectorStocks } from "./lib/actions/sector-analysis";
import { mapSnapshotToStockData } from "./components/dashboard/TablaIFS";

async function testWithUSStocks() {
  console.log("🧪 Testing with US stocks that HAVE IFS data\n");
  console.log("=".repeat(70));

  // Get large sample from US market
  const result = await fetchSectorStocks({
    selectedCountry: "US",
    page: 0,
    pageSize: 50,
  });

  console.log(`\n✅ Fetched ${result.stocks.length} US stocks`);

  // Filter stocks that have IFS
  const stocksWithIFS = result.stocks.filter((s) => s.ifs !== null);

  console.log(
    `\n📊 Stocks WITH IFS: ${stocksWithIFS.length} / ${result.stocks.length}`,
  );
  console.log(
    `📊 Stocks WITHOUT IFS: ${result.stocks.length - stocksWithIFS.length} / ${result.stocks.length}`,
  );

  if (stocksWithIFS.length > 0) {
    console.log("\n✅ Stocks WITH IFS Live:");
    console.log("=".repeat(70));

    stocksWithIFS.slice(0, 5).forEach((stock, i) => {
      console.log(`\n${i + 1}. ${stock.ticker}:`);
      console.log(`   ifs:`, JSON.stringify(stock.ifs));

      // Test mapper
      const mapped = mapSnapshotToStockData(stock);
      console.log(
        `   Mapped IFS:`,
        mapped.ifs
          ? `${mapped.ifs.position} (pressure: ${mapped.ifs.pressure})`
          : "NULL",
      );
    });
  } else {
    console.log("\n❌ NO stocks with IFS found in sample");
  }

  console.log("\n" + "=".repeat(70));
}

testWithUSStocks().catch(console.error);
