import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
  console.log('🚀 Loading performance-windows-aggregator...');

  // Dynamic import to ensure env vars are loaded
  const { runPerformanceWindowsAggregator } = await import('@/app/api/cron/performance-windows-aggregator/core');

  console.log('▶️ Running aggregation...');
  
  try {
    const result = await runPerformanceWindowsAggregator();
    console.log('✅ Aggregation result:', JSON.stringify(result, null, 2));
    
    if (result.ok) {
      console.log('🎉 Success!');
    } else {
      console.error('⚠️ Finished with errors.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Critical failure:', error);
    process.exit(1);
  }
}

main();
