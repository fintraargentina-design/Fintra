import { loadEnv } from '../utils/load-env';

loadEnv();

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
