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
