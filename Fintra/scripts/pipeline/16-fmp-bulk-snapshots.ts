import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
  const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');
  
  const args = process.argv.slice(2);
  const arg1 = args[0];
  const arg2 = args[1];

  let limit: number | undefined = undefined;
  let ticker: string | undefined = undefined;

  // Simple parsing: if first arg is number -> limit, else -> ticker
  if (arg1) {
    const parsed = parseInt(arg1, 10);
    if (!isNaN(parsed) && parsed.toString() === arg1) {
        limit = parsed;
        if (arg2) ticker = arg2;
    } else {
        ticker = arg1;
    }
  }

  console.log(`🚀 Running FMP Bulk Snapshots (Limit: ${limit || 'ALL'}, Ticker: ${ticker || 'ALL'})...`);
  try {
    await runFmpBulk(ticker, limit);
    console.log('✅ FMP Bulk Snapshots completed.');
  } catch (e) {
    console.error('❌ FMP Bulk Snapshots failed:', e);
    process.exit(1);
  }
}

main();
