import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
  const { runSyncUniverse } = await import('@/app/api/cron/sync-universe/core');
  
  console.log('🚀 Running Sync Universe...');
  try {
    await runSyncUniverse();
    console.log('✅ Sync Universe completed.');
  } catch (e) {
    console.error('❌ Sync Universe failed:', e);
    process.exit(1);
  }
}

main();
