import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
  const { checkSnapshotsHealth } = await import('@/app/api/cron/healthcheck-fmp-bulk/core');
  
  console.log('🚀 Running Healthcheck Snapshots...');
  try {
    await checkSnapshotsHealth();
    console.log('✅ Healthcheck Snapshots completed.');
  } catch (e) {
    console.error('❌ Healthcheck Snapshots failed:', e);
    process.exit(1);
  }
}

main();
