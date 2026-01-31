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
  const { runIndustryPerformanceAggregator } = await import('@/app/api/cron/industry-performance-aggregator/core');
  
  console.log('🚀 Running Industry Performance Aggregator (1D)...');
  try {
    await runIndustryPerformanceAggregator();
    console.log('✅ Industry Performance Aggregator completed.');
  } catch (e) {
    console.error('❌ Industry Performance Aggregator failed:', e);
    process.exit(1);
  }
}

main();
