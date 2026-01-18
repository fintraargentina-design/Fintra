import { supabaseAdmin } from '@/lib/supabase-admin';
import { fmpGet } from '@/lib/fmp/server';
import dayjs from 'dayjs';

type FmpIndustryPeSnapshot = {
  industry: string;
  pe: number | null;
};

export async function runIndustryPeAggregator() {
  console.log('Starting industry PE aggregator');

  let targetDate = dayjs().subtract(1, 'day');

  while (targetDate.day() === 0 || targetDate.day() === 6) {
    targetDate = targetDate.subtract(1, 'day');
  }

  const dateStr = targetDate.format('YYYY-MM-DD');
  console.log(`Target date resolved to: ${dateStr}`);

  try {
    const snapshot = await fmpGet<FmpIndustryPeSnapshot[]>(
      `/stable/industry-pe-snapshot?date=${dateStr}`
    );

    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
      console.log(`No Industry PE data returned for ${dateStr}`);
      return;
    }

    const rows = snapshot
      .filter((row) => !!row.industry)
      .map((row) => ({
        industry: row.industry,
        pe_date: dateStr,
        pe: typeof row.pe === 'number' ? row.pe : row.pe ?? null,
        source: 'fmp_industry_pe_snapshot',
      }));

    if (!rows.length) {
      console.log(`No valid Industry PE rows to insert for ${dateStr}`);
      return;
    }

    const { error } = await supabaseAdmin
      .from('industry_pe')
      .upsert(rows, { onConflict: 'industry,pe_date' });

    if (error) {
      console.error('Error upserting industry_pe rows:', error);
      return;
    }

    console.log(`Inserted or updated ${rows.length} industry_pe rows for ${dateStr}`);
  } catch (err) {
    console.error('Unexpected error in industry PE aggregator:', err);
  }

  console.log('Industry PE aggregator completed');
}

