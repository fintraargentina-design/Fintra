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
  const { runCompanyProfileBulk } = await import('@/app/api/cron/company-profile-bulk/core');
  
  const args = process.argv.slice(2);
  const limit = args[0] ? parseInt(args[0], 10) : undefined;

  console.log(`🚀 Running Company Profile Bulk (Limit: ${limit || 'ALL'})...`);
  try {
    await runCompanyProfileBulk(limit);
    console.log('✅ Company Profile Bulk completed.');
  } catch (e) {
    console.error('❌ Company Profile Bulk failed:', e);
    process.exit(1);
  }
}

main();
