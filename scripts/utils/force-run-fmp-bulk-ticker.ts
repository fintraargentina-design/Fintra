import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

async function main() {
  const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');

  const args = process.argv.slice(2);
  const ticker = args[0] || undefined;
  const limitArg = args[1] ? parseInt(args[1], 10) : undefined;
  const limit = limitArg && !Number.isNaN(limitArg) ? limitArg : undefined;

  if (!ticker) {
    console.error('Usage: npx tsx scripts/force-run-fmp-bulk-ticker.ts <TICKER> [limit]');
    process.exit(1);
  }

  console.log(`🚀 Forcing runFmpBulk for ticker=${ticker} limit=${limit ?? 'default'}...`);

  try {
    const result = await runFmpBulk(ticker, limit);
    console.log('[FmpBulk] Result:', JSON.stringify(result));
    console.log('✅ runFmpBulk completed.');
  } catch (e) {
    console.error('❌ runFmpBulk failed:', e);
    process.exit(1);
  }
}

main();

