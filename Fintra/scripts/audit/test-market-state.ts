
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

// Import core after env
import { runMarketStateBulk } from '../app/api/cron/market-state-bulk/core';

async function main() {
  console.log('Testing Market State Bulk...');
  try {
    const result = await runMarketStateBulk(undefined, 100); // Process first 100 tickers
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
