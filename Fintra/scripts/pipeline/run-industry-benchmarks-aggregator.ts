import { loadEnv } from '../utils/load-env';

loadEnv();

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

