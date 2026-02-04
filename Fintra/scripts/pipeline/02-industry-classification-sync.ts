import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
  const { runIndustryClassificationSync } = await import('@/app/api/cron/industry-classification-sync/core');
  
  console.log('🚀 Running Industry Classification Sync...');
  try {
    await runIndustryClassificationSync();
    console.log('✅ Industry Classification Sync completed.');
  } catch (e) {
    console.error('❌ Industry Classification Sync failed:', e);
    process.exit(1);
  }
}

main();
