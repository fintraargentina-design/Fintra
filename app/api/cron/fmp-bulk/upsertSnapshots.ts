// Fintra/app/api/cron/fmp-bulk/upsertSnapshots.ts

export async function upsertSnapshots(
  supabase: any,
  rows: any[]
) {
  if (rows.length === 0) return;

  const today = rows[0].snapshot_date;
  const tickers = rows.map(r => r.ticker);

  // 1. Fetch existing snapshots to check for "on_demand" protection
  const { data: existingSnapshots } = await supabase
    .from('fintra_snapshots')
    .select('ticker, sector, profile_structural')
    .in('ticker', tickers)
    .eq('snapshot_date', today);

  const protectionMap = new Map<string, any>();
  
  if (existingSnapshots) {
    const now = new Date();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    for (const existing of existingSnapshots) {
      const ps = existing.profile_structural;
      if (ps?.source === 'on_demand' && ps?.last_updated) {
        const lastUpdate = new Date(ps.last_updated).getTime();
        // Check freshness (< 24h)
        if (now.getTime() - lastUpdate < ONE_DAY_MS) {
          protectionMap.set(existing.ticker, existing);
        }
      }
    }
  }

  // 2. Apply protection: Overwrite bulk row with existing high-quality profile
  const finalRows = rows.map(row => {
    const protectedData = protectionMap.get(row.ticker);
    if (protectedData) {
      // Preserve existing profile and sector
      return {
        ...row,
        sector: protectedData.sector,
        profile_structural: protectedData.profile_structural
        // Note: We deliberately overwrite other fields (metrics, ratios) from bulk
        // as they might be newer/better, and "profile" scope is strict.
      };
    }
    return row;
  });

  // 3. Perform the Upsert
  const { error } = await supabase
    .from('fintra_snapshots')
    .upsert(finalRows, {
      onConflict: 'ticker,snapshot_date,engine_version'
    });

  if (error) throw error;
}
