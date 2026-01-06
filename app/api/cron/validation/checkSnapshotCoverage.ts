// cron/validation/checkSnapshotCoverage.ts
import { supabase } from '@/lib/supabase';

export async function checkSnapshotCoverage(minSnapshots = 30) {
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('ticker, snapshot_date');

  if (error) throw error;

  const byTicker: Record<string, number> = {};
  data.forEach(r => {
    byTicker[r.ticker] = (byTicker[r.ticker] || 0) + 1;
  });

  const broken = Object.entries(byTicker)
    .filter(([_, cnt]) => cnt < minSnapshots);

  if (broken.length) {
    console.warn(
      `⚠️ Tickers con pocos snapshots:`,
      broken.slice(0, 10)
    );
  }
}
