
import { fmpGet } from '@/lib/fmp/server';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env if needed

async function main() {
  const tickers = ['AAPL', 'MSFT', 'TSLA', 'BRK.B', 'SPY', 'V', 'KO'];
  
  for (const ticker of tickers) {
      console.log(`\nProbing FMP endpoints for ${ticker}...`);
      const path = `/api/v3/profile/${ticker}`;
      try {
        const res = await fmpGet(path);
        // @ts-ignore
        if (res && res.length > 0) {
            // @ts-ignore
            console.log(`${ticker} Image URL: ${res[0].image}`);
        } else {
            console.log(`${ticker} No data found`);
        }
      } catch (e: any) {
        console.log(`FAILED: ${path} - ${e.message}`);
      }
  }
}

main();
