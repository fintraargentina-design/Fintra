import { supabaseAdmin } from '@/lib/supabase-admin';

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
