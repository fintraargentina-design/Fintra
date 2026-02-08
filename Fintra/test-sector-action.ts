import { fetchSectorStocks } from "./lib/actions/sector-analysis";

async function testSectorAction() {
  console.log("🧪 Testing fetchSectorStocks Server Action\n");
  console.log("=".repeat(70));

  const result = await fetchSectorStocks({
    selectedCountry: "US",
    selectedSector: "Technology",
    selectedIndustry: "Software - Application",
    page: 0,
    pageSize: 5,
  });

  console.log("\n📊 Result Summary:");
  console.log("   Total stocks:", result.stocks.length);
  console.log("   Has more:", result.hasMore);
  console.log(
    "   Completeness:",
    result.dataQuality.completeness.toFixed(1) + "%",
  );

  console.log("\n📋 First 3 stocks with IFS data:");
  console.log("=".repeat(70));

  result.stocks.slice(0, 3).forEach((stock, i) => {
    console.log(`\n${i + 1}. ${stock.ticker}:`);
    console.log("   ifs:", JSON.stringify(stock.ifs, null, 2));
    console.log("   ifs_fy:", stock.ifs_fy ? "EXISTS" : "null");
    console.log("   fgos_score:", stock.fgos_score);
    console.log(
      "   market_cap:",
      stock.market_cap || stock.market_snapshot?.market_cap,
    );
  });

  console.log("\n" + "=".repeat(70));
}

testSectorAction().catch(console.error);
