// cron/validation/checkSectorStats.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function checkSectorStats() {
  const { data, error } = await supabaseAdmin
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
