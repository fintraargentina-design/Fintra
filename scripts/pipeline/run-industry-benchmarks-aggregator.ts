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
  const { runIndustryBenchmarksAggregator } = await import(
    '@/app/api/cron/industry-benchmarks-aggregator/core'
  );

  console.log('🚀 Running Industry Benchmarks Aggregator...');

  try {
    const result = await runIndustryBenchmarksAggregator();
    console.log('✅ Industry Benchmarks Aggregator completed.', result);
  } catch (e) {
    console.error('❌ Industry Benchmarks Aggregator failed:', e);
    process.exit(1);
  }
}

main();

