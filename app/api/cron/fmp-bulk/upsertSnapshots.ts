// Fintra/app/api/cron/fmp-bulk/upsertSnapshots.ts

export async function upsertSnapshots(
  supabase: any,
  rows: any[]
) {
  const { error } = await supabase
    .from('fintra_snapshots')
    .upsert(rows, {
      onConflict: 'ticker,snapshot_date,engine_version'
    });

  if (error) throw error;
}
