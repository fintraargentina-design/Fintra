
import dotenv from 'dotenv';
import path from 'path';
import dayjs from 'dayjs';

// Load Environment Variables
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Error loading .env.local:', result.error);
  process.exit(1);
}

// Dynamic import to ensure env vars are loaded first
async function main() {
  const { runPricesDailyBulk } = await import('@/app/api/cron/prices-daily-bulk/core');

  const args = process.argv.slice(2);
  const startDateArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
  const endDateArg = args.find(a => a.startsWith('--end='))?.split('=')[1];

  if (!startDateArg || !endDateArg) {
    console.error('Usage: npx tsx scripts/backfill-prices.ts --start=YYYY-MM-DD --end=YYYY-MM-DD');
    process.exit(1);
  }

  const start = dayjs(startDateArg);
  const end = dayjs(endDateArg);

  if (!start.isValid() || !end.isValid()) {
    console.error('Invalid dates provided.');
    process.exit(1);
  }

  if (end.isBefore(start)) {
    console.error('End date must be after start date.');
    process.exit(1);
  }

  console.log(`\n🚀 STARTING BACKFILL: ${start.format('YYYY-MM-DD')} -> ${end.format('YYYY-MM-DD')}`);
  console.log('--------------------------------------------------');

  let current = start;
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    const dayOfWeek = current.day(); // 0=Sun, 6=Sat

    // Optional: Skip weekends if you want to save API calls/time
    // FMP EOD Bulk usually returns empty or previous data for weekends, but checking strict trading days is complex.
    // The safest approach is to run for every day or skip Sat/Sun if we know FMP doesn't publish.
    // FMP EOD Bulk usually has data for trading days.
    // Let's run for all days and let the API/Core handle empty CSVs if any.
    // Actually, optimization: skip Sat(6) and Sun(0).
    if (dayOfWeek === 0 || dayOfWeek === 6) {
       console.log(`[${dateStr}] Skipping Weekend`);
       current = current.add(1, 'day');
       continue;
    }

    console.log(`\n📅 Processing ${dateStr}...`);
    try {
      const result = await runPricesDailyBulk({ date: dateStr });
      if (result.success) {
        console.log(`✅ Success: Inserted=${result.stats?.inserted ?? 0}, Skipped=${result.stats?.skipped ?? 0}, Errors=${result.stats?.errors ?? 0}`);
        if (result.log && result.log.length > 0) {
            console.log('--- Log ---');
            console.log(result.log.join('\n'));
            console.log('-----------');
        }
      } else {
        console.error(`❌ Failed: ${result.error}`);
      }
    } catch (err: any) {
      console.error(`💥 Exception: ${err.message}`);
    }

    // Small delay to be gentle on DB/API
    await new Promise(r => setTimeout(r, 500));
    
    current = current.add(1, 'day');
  }

  console.log('\n✨ Backfill Complete.');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
