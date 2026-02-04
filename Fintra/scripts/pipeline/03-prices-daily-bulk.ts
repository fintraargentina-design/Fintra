
import dayjs from 'dayjs';
import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
  const { runPricesDailyBulk } = await import('@/app/api/cron/prices-daily-bulk/core');

  const args = process.argv.slice(2);
  let startDateArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
  let endDateArg = args.find(a => a.startsWith('--end='))?.split('=')[1];

  if (!startDateArg || !endDateArg) {
    console.log('No date range provided. Defaulting to LAST 5 DAYS (including today) for daily cron execution.');
    // Default to last 5 days (including today)
    const end = dayjs();
    const start = end.subtract(4, 'day'); // Today + 4 previous days = 5 days total
    
    startDateArg = startDateArg || start.format('YYYY-MM-DD');
    endDateArg = endDateArg || end.format('YYYY-MM-DD');
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
