// cron/validation/checkNoFutureData.ts
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function checkNoFutureData() {
  const { data, error } = await supabaseAdmin.rpc('execute_sql', {
    sql: `
      select count(*) as cnt
      from fintra_snapshots s
      join datos_financieros f
        on f.ticker = s.ticker
      where f.period_end_date > s.snapshot_date;
    `
  });

  if (error) throw error;

  const count = Number(data?.[0]?.cnt ?? 0);
  if (count > 0) {
    throw new Error(
      `Uso de datos futuros detectado: ${count} casos`
    );
  }
}
