import { supabaseAdmin } from '@/lib/supabase-admin';

const WINDOW_CONFIG: { code: string; days?: number }[] = [
  // Excluded from structural calculations by canonical window policy (Phase 9)
  // { code: '1W', days: 5 },
  { code: '1M', days: 21 },
  { code: '3M', days: 63 },
  { code: '6M', days: 126 },
  // { code: 'YTD' }, // Excluded (Phase 9)
  { code: '1Y', days: 252 },
  { code: '2Y', days: 504 },
  { code: '3Y', days: 756 },
  { code: '5Y', days: 1260 },
];

type SectorDailyRow = {
  sector: string;
  performance_date: string;
  return_percent: number | null;
};

type AggregatorResult = {
  ok: boolean;
  as_of_date: string | null;
  windows_written: number;
  sectors_processed: number;
  windows_skipped: number;
};

export async function runSectorPerformanceWindowsAggregator(): Promise<AggregatorResult> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    console.log(`[sector-performance-windows] Using as_of_date=${today}`);

    const { error: rpcError } = await supabaseAdmin.rpc('calculate_sector_windows_from_returns', {
      p_as_of_date: today,
    });

    if (rpcError) {
      console.error('[sector-performance-windows] RPC error:', rpcError);
      return {
        ok: false,
        as_of_date: today,
        windows_written: 0,
        sectors_processed: 0,
        windows_skipped: 0,
      };
    }

    console.log('[sector-performance-windows] RPC completed successfully.');

    return {
      ok: true,
      as_of_date: today,
      windows_written: -1, // SQL function handles this
      sectors_processed: -1, // SQL function handles this
      windows_skipped: 0,
    };
  } catch (err) {
    console.error('[sector-performance-windows] Fatal error:', err);
    return {
      ok: false,
      as_of_date: null,
      windows_written: 0,
      sectors_processed: 0,
      windows_skipped: 0,
    };
  }
}
