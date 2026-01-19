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
