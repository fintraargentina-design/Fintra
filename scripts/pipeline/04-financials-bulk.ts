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
  const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
  
  const args = process.argv.slice(2);
  const limit = args[0] ? parseInt(args[0], 10) : undefined;

  console.log(`🚀 Running Financials Bulk (Limit: ${limit || 'ALL'})...`);
  try {
    await runFinancialsBulk(undefined, limit);
    console.log('✅ Financials Bulk completed.');
  } catch (e) {
    console.error('❌ Financials Bulk failed:', e);
    process.exit(1);
  }
}

main();
