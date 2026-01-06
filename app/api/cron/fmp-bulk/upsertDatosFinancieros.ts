import { SupabaseClient } from '@supabase/supabase-js';

export async function upsertDatosFinancieros(client: SupabaseClient, rows: any[]) {
  if (!rows.length) return;

  const { error } = await client
    .from('datos_financieros')
    .upsert(rows, {
      onConflict: 'ticker,period_type,period_label'
    });

  if (error) throw error;
}
