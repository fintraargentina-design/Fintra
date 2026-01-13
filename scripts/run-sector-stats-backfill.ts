
import { backfillSectorStatsForDate } from '../app/api/cron/backfill/backfillSectorStats';

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Running sector_stats backfill for ${today}...`);
  try {
    await backfillSectorStatsForDate(today);
    console.log('✅ sector_stats backfill completed successfully.');
  } catch (error) {
    console.error('❌ Error backfilling sector_stats:', error);
    process.exit(1);
  }
}

main();
