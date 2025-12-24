
import { calculateFGOS } from '@/lib/engine/fintra-brain';

const WATCHLIST_MVP = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'MELI', 'GLOB'];

async function main() {
  console.log("Starting FGOS Test for WATCHLIST_MVP...");
  
  for (const ticker of WATCHLIST_MVP) {
    console.log(`\nTesting FGOS for ${ticker}...`);
    try {
      const result = await calculateFGOS(ticker);
      if (result) {
        console.log(`[SUCCESS] ${ticker}: Score ${result.fgos_score}`);
      } else {
        console.error(`[FAILURE] ${ticker}: Result is null`);
      }
    } catch (error) {
      console.error(`[ERROR] ${ticker}:`, error);
    }
  }
}

main();
