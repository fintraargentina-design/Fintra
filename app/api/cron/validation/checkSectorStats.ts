// cron/validation/checkSectorStats.ts
import { supabase } from '@/lib/supabase';

export async function checkSectorStats() {
  const { data, error } = await supabase
    .from('sector_stats')
    .select('*')
    .lt('sample_size', 10);

  if (error) throw error;

  if (data.length) {
    console.warn(
      `⚠️ sector_stats con sample_size bajo: ${data.length} filas`
    );
  }
}
