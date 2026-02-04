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
  const { runPerformanceBulk } = await import('@/app/api/cron/performance-bulk/core');

  const args = process.argv.slice(2);
  const ticker = args[0] || undefined;
  const limitArg = args[1] ? parseInt(args[1], 10) : undefined;
  const limit = limitArg && !Number.isNaN(limitArg) ? limitArg : undefined;

  console.log(`[PerformanceBulk] Forcing runPerformanceBulk for ticker=${ticker ?? 'ALL'} limit=${limit ?? 'default'}...`);

  try {
    const result = await runPerformanceBulk(ticker, limit);
    console.log('[PerformanceBulk] Result:', JSON.stringify(result));
    console.log('✅ runPerformanceBulk completed.');
  } catch (e) {
    console.error('❌ runPerformanceBulk failed:', e);
    process.exit(1);
  }
}

main();

