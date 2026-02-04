import 'dotenv/config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fmpGet } from '@/lib/fmp/server';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const THROTTLE_MS = 850;
// const WINDOW_CODE = '1D'; // Removed as we use explicit table for daily
const SOURCE = 'fmp_snapshot';

type FmpIndustrySnapshot = {
  date: string;
  industry: string;
  averageChange: number | null;
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfillIndustryPerformance(startDate: string, endDate: string) {
  const start = dayjs(startDate, 'YYYY-MM-DD');
  const end = dayjs(endDate, 'YYYY-MM-DD');
  
  if (!start.isValid() || !end.isValid()) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  let currentDate = start;
  let processedCount = 0;
  let skippedCount = 0;

  console.log(`Starting backfill from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);

  while (currentDate.isBefore(end) || currentDate.isSame(end)) {
    // Skip weekends (Sunday=0, Saturday=6)
    const dayOfWeek = currentDate.day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate = currentDate.add(1, 'day');
      continue;
    }

    const targetDate = currentDate.format('YYYY-MM-DD');
    console.log(`Processing date: ${targetDate}`);

    try {
      // Check existing rows to ensure idempotency
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('industry_performance_daily')
        .select('industry')
        .eq('performance_date', targetDate);

      if (checkError) {
        console.error(`Error checking existing data for ${targetDate}:`, checkError);
        // Abort-safe: stop on db error to avoid mess
        throw checkError;
      }

      const existingIndustries = new Set(existing?.map(row => row.industry) || []);

      // If we already have data for this date, and it looks complete (e.g. > 0 rows), 
      // we might want to skip or just fill gaps. 
      // The requirement says "Insert only if (industry, date) does not exist".
      // So we fetch and filter.

      // Fetch snapshot from FMP
      // Endpoint: /stable/industry-performance-snapshot?date=YYYY-MM-DD
      const snapshot = await fmpGet<FmpIndustrySnapshot[]>(
        `/stable/industry-performance-snapshot?date=${targetDate}`
      );

      if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
        const insertRows = snapshot
          .filter(row => row.industry && !existingIndustries.has(row.industry))
          .map(row => ({
            industry: row.industry,
            performance_date: targetDate,
            return_percent: row.averageChange,
            source: SOURCE
          }));

        if (insertRows.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('industry_performance_daily')
            .insert(insertRows);
          
          if (insertError) {
            console.error(`Error inserting rows for ${targetDate}:`, insertError);
            throw insertError;
          }
          console.log(`✅ Inserted ${insertRows.length} rows for ${targetDate}`);
          processedCount++;
        } else {
          console.log(`ℹ️ All industries already exist for ${targetDate}`);
          skippedCount++;
        }
      } else {
        console.log(`⚠️ No data returned from FMP for ${targetDate}`);
      }

    } catch (err) {
      console.error(`Failed to process ${targetDate}:`, err);
      // Abort-safe: Exit on error
      process.exit(1);
    }

    await sleep(THROTTLE_MS);
    currentDate = currentDate.add(1, 'day');
  }

  console.log('Backfill completed successfully');
  console.log(`Days processed with inserts: ${processedCount}`);
  console.log(`Days skipped (already exists): ${skippedCount}`);
}

// CLI handling
const [startDate, endDate] = process.argv.slice(2);
if (!startDate || !endDate) {
  console.error('Usage: npx tsx scripts/backfill-industry-performance.ts <startDate> <endDate> (YYYY-MM-DD)');
  process.exit(1);
}

backfillIndustryPerformance(startDate, endDate).catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
