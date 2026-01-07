// cron/validation/checkFGOSDistribution.ts

import { supabaseAdmin } from '@/lib/supabase-admin';

export async function checkFGOSDistribution() {
  const { data, error } = await supabaseAdmin.rpc('execute_sql', {
    sql: `
      select
        min(fgos_score) as min,
        max(fgos_score) as max,
        avg(fgos_score) as avg
      from fintra_snapshots;
    `
  });

  if (error) throw error;

  // 👇 CORRECCIÓN CLAVE
  if (!data || data.length === 0 || data[0].min === null) {
    console.warn('⚠️ FGOS distribution: no hay snapshots todavía');
    return;
  }

  const { min, max } = data[0];

  if (min < 0 || max > 100) {
    throw new Error('FGOS fuera de rango');
  }

  if (max < 40) {
    console.warn('⚠️ FGOS muy bajo en general (posible falta de datos)');
  }
}
