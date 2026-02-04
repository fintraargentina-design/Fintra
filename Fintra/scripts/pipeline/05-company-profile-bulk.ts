import { loadEnv } from '../utils/load-env';

loadEnv();

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
