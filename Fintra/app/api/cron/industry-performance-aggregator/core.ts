import { supabaseAdmin } from '@/lib/supabase-admin';
import { fmpGet } from '@/lib/fmp/server';
import dayjs from 'dayjs';

const WINDOW_CODE = '1D';
const SOURCE = 'fmp_snapshot';

type FmpIndustrySnapshot = {
  date: string;
  industry: string;
  averageChange: number | null;
};

export async function runIndustryPerformanceAggregator() {
  console.log('Starting industry performance aggregator');

  // Resolve target trading day
  // Strategy: Start from yesterday. Rewind if it's a weekend.
  
  let targetDate = dayjs().subtract(1, 'day');
  
  // Rewind until we hit a weekday (0=Sun, 6=Sat)
  while (targetDate.day() === 0 || targetDate.day() === 6) {
    targetDate = targetDate.subtract(1, 'day');
  }

  const dateStr = targetDate.format('YYYY-MM-DD');
  console.log(`Target date resolved to: ${dateStr}`);

  try {
    // Check existing rows to avoid duplicates
    const { data: existing, error: dbError } = await supabaseAdmin
      .from('industry_performance')
      .select('industry')
      .eq('performance_date', dateStr)
      .eq('window_code', WINDOW_CODE);

    if (dbError) {
      console.error('Database error checking existence:', dbError);
      return; // Exit successfully as per "Log and exit successfully" rule for failures
    }

    const existingIndustries = new Set(existing?.map(row => row.industry) || []);

    // Fetch snapshot
    const snapshot = await fmpGet<FmpIndustrySnapshot[]>(
      `/stable/industry-performance-snapshot?date=${dateStr}`
    );

    if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
      const insertRows = snapshot
        .filter(row => row.industry && !existingIndustries.has(row.industry))
        .map(row => ({
          industry: row.industry,
          window_code: WINDOW_CODE,
          performance_date: dateStr,
          return_percent: row.averageChange,
          source: SOURCE
        }));

      if (insertRows.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('industry_performance')
          .insert(insertRows);

        if (insertError) {
          console.error('Database error inserting rows:', insertError);
        } else {
          console.log(`✅ Inserted ${insertRows.length} rows for ${dateStr}`);
        }
      } else {
        console.log(`ℹ️ No new rows to insert for ${dateStr} (all exist or filtered)`);
      }
    } else {
      console.log(`⚠️ Snapshot endpoint returned empty or null for ${dateStr}`);
    }

  } catch (err) {
    console.error('Unexpected error in aggregator:', err);
    // "Log and exit successfully" implies we don't crash the process or return 500 if called via API,
    // just log it.
  }

  console.log('Aggregator completed');
}
