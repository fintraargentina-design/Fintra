
import { fmpGet } from './lib/fmp/server';

process.env.FMP_API_KEY = "scYafUs9cEq4PzLVbZ8SPlmMh8r9Jm8V";
process.env.FMP_BASE_URL = "https://financialmodelingprep.com";

async function main() {
  try {
    console.log("Fetching key-metrics (period=ttm) for AAPL...");
    const data = await fmpGet('/api/v3/key-metrics/AAPL?period=ttm&limit=1');
    console.log("Key Metrics TTM (via param) Result:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

main();
