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
