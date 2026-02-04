import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
  const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
  
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let targetTicker: string | undefined;
  let years: number[] | undefined;

  // Simple arg parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--limit') {
      limit = parseInt(args[++i], 10);
    } else if (arg === '--ticker') {
      targetTicker = args[++i];
    } else if (arg === '--years') {
      const yearStr = args[++i];
      if (yearStr.includes('-')) {
        const [start, end] = yearStr.split('-').map(y => parseInt(y, 10));
        years = [];
        for (let y = start; y <= end; y++) years.push(y);
      } else {
        years = yearStr.split(',').map(y => parseInt(y, 10));
      }
    } else if (!arg.startsWith('--') && !limit && !targetTicker && !years) {
      // Legacy support for plain limit argument if no flags used
      const val = parseInt(arg, 10);
      if (!isNaN(val)) limit = val;
    }
  }

  console.log(`🚀 Running Financials Bulk...`);
  console.log(`   - Limit: ${limit || 'ALL'}`);
  console.log(`   - Ticker: ${targetTicker || 'ALL'}`);
  console.log(`   - Years: ${years ? years.join(', ') : 'Default (2020-2026)'}`);

  try {
    await runFinancialsBulk(targetTicker, limit, years);
    console.log('✅ Financials Bulk completed.');
  } catch (e) {
    console.error('❌ Financials Bulk failed:', e);
    process.exit(1);
  }
}

main();
