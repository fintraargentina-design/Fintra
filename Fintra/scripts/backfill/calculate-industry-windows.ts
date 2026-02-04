
import 'dotenv/config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

async function calculateIndustryWindows(startDate?: string, endDate?: string) {
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  if (startDate && endDate) {
    start = dayjs(startDate, 'YYYY-MM-DD');
    end = dayjs(endDate, 'YYYY-MM-DD');
  } else {
    // Default to latest date in industry_performance_daily
    console.log('No date range provided. Finding latest date with data...');
    const { data, error } = await supabaseAdmin
      .from('industry_performance_daily')
      .select('performance_date')
      .order('performance_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest date:', error);
      process.exit(1);
    }

    if (!data) {
      console.error('No data found in industry_performance_daily.');
      process.exit(1);
    }

    console.log(`Latest date found: ${data.performance_date}`);
    start = dayjs(data.performance_date);
    end = start;
  }

  let currentDate = start;
  let processedCount = 0;

  console.log(`Starting calculation from ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')}`);

  while (currentDate.isBefore(end) || currentDate.isSame(end)) {
    const targetDate = currentDate.format('YYYY-MM-DD');
    console.log(`Calculating windows for: ${targetDate}`);

    const { error } = await supabaseAdmin.rpc('calculate_industry_windows_from_returns', {
      p_as_of_date: targetDate
    });

    if (error) {
      console.error(`Error calculating windows for ${targetDate}:`, error);
    } else {
      console.log(`✅ Calculated windows for ${targetDate}`);
      processedCount++;
    }

    currentDate = currentDate.add(1, 'day');
  }

  console.log('Calculation completed.');
  console.log(`Days processed: ${processedCount}`);
}

// CLI handling
const [startDateArg, endDateArg] = process.argv.slice(2);
calculateIndustryWindows(startDateArg, endDateArg).catch(err => {
  console.error('Calculation failed:', err);
  process.exit(1);
});
