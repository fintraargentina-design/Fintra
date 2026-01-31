
import { directFetcher } from "../lib/fmp/direct";

async function testQuote() {
  const tickers = ["^GSPC", "^IXIC", "^DJI", "AAPL", "MSFT"];
  const tickersString = tickers.join(',');

  console.log(`Testing quote for: ${tickersString}`);

  try {
    const data = await directFetcher("/quote", { params: { symbol: tickersString } });
    console.log("Result type:", Array.isArray(data) ? "Array" : typeof data);
    console.log("Result length:", Array.isArray(data) ? data.length : "N/A");
    console.log("First item:", Array.isArray(data) && data.length > 0 ? data[0] : data);
  } catch (error) {
    console.error("Error fetching quote:", error);
  }
}

testQuote();
