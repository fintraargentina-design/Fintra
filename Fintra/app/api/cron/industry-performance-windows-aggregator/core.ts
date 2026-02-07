import { supabaseAdmin } from '@/lib/supabase-admin';

type AggregatorResult = {
  ok: boolean;
  as_of_date: string | null;
  windows_written: number;
  industries_processed: number;
  windows_skipped: number;
};

export async function runIndustryPerformanceWindowsAggregator(): Promise<AggregatorResult> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    console.log(`[industry-performance-windows] Using as_of_date=${today}`);

    // Call the RPC function that handles everything in the database
    // This function was created in migration: 20260203100000_add_industry_windows_aggregator.sql
    const { error: rpcError } = await supabaseAdmin.rpc('calculate_industry_windows_from_returns', {
      p_as_of_date: today,
    });

    if (rpcError) {
      console.error('[industry-performance-windows] RPC error:', rpcError);
      return {
        ok: false,
        as_of_date: today,
        windows_written: 0,
        industries_processed: 0,
        windows_skipped: 0,
      };
    }

    console.log('[industry-performance-windows] RPC completed successfully.');

    return {
      ok: true,
      as_of_date: today,
      windows_written: -1, // Handled by DB
      industries_processed: -1, // Handled by DB
      windows_skipped: 0,
    };
  } catch (err) {
    console.error('[industry-performance-windows] Fatal error:', err);
    return {
      ok: false,
      as_of_date: null,
      windows_written: 0,
      industries_processed: 0,
      windows_skipped: 0,
    };
  }
}
