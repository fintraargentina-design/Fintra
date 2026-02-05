
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: '.env.local' });

async function main() {
  // Dynamically import to ensure env vars are loaded
  const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
  
  const args = process.argv.slice(2);
  const ticker = args.find(a => a.startsWith('--ticker='))?.split('=')[1];
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg) : undefined;
  const force = args.includes('--force');
  const skipDownload = args.includes('--skip-download');

  console.log(`🚀 Starting Financials Bulk Trigger...`);
  console.log(`Target: ${ticker || 'ALL Active Tickers'}`);
  console.log(`Limit: ${limit || 'None'}`);
  console.log(`Force Update: ${force}`);
  console.log(`Skip Download: ${skipDownload}`);
  console.log('------------------------------------------------');

  if (!process.env.FMP_API_KEY) {
      console.error('❌ Missing FMP_API_KEY in .env.local');
      process.exit(1);
  }

  try {
    const stats = await runFinancialsBulk(ticker, limit, undefined, force, skipDownload);
    console.log('\n✨ Completed Successfully!');
    console.log(JSON.stringify(stats, null, 2));
  } catch (err: any) {
    console.error('\n❌ Fatal Error:', err.message || err);
    process.exit(1);
  }
}

main();
