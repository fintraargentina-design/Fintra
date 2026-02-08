/**
 * TEST: FMP Historical API
 * Quick test to verify API key and data availability
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const FMP_API_KEY = process.env.FMP_API_KEY;

async function testFetch(ticker: string) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 30); // Only 30 days for test

  const fromDate = startDate.toISOString().split("T")[0];
  const toDate = today.toISOString().split("T")[0];

  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?from=${fromDate}&to=${toDate}&apikey=${FMP_API_KEY}`;

  console.log(`\n📡 Testing FMP API for ${ticker}...`);
  console.log(`   URL: ${url.replace(FMP_API_KEY!, "API_KEY_HIDDEN")}`);
  console.log(`   Date range: ${fromDate} → ${toDate}\n`);

  try {
    const response = await fetch(url);
    console.log(
      `✅ Response status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Error response:`, text);
      return;
    }

    const data = await response.json();

    console.log(`📊 Data structure:`, Object.keys(data));

    if (data.historical && Array.isArray(data.historical)) {
      console.log(`✅ Historical data points: ${data.historical.length}`);

      if (data.historical.length > 0) {
        console.log(`\n📅 First data point:`, data.historical[0]);
        console.log(
          `📅 Last data point:`,
          data.historical[data.historical.length - 1],
        );

        // Calculate a sample return
        if (data.historical.length >= 2) {
          const today = data.historical[0];
          const yesterday = data.historical[1];
          const returnPct =
            ((today.adjClose - yesterday.adjClose) / yesterday.adjClose) * 100;
          console.log(`\n💹 Sample 1D return: ${returnPct.toFixed(2)}%`);
        }
      }
    } else {
      console.warn(`⚠️  No historical data in response`);
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`❌ Fetch error:`, error);
  }
}

async function main() {
  if (!FMP_API_KEY) {
    console.error("❌ FMP_API_KEY no encontrado en .env.local");
    process.exit(1);
  }

  console.log("🔑 FMP API Key: " + FMP_API_KEY.substring(0, 8) + "...");

  // Test with AAPL (should always have data)
  await testFetch("AAPL");

  // Test with another ticker
  await testFetch("MSFT");
}

main().catch(console.error);
