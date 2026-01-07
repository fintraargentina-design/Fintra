
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retrieves the list of active stock tickers from fintra_active_stocks.
 * 
 * BUSINESS RULE:
 * - Must be 'stock' type (excludes ETFs, Funds, etc).
 * - Must be is_active = true.
 * - Used as the single source of truth for snapshots and benchmarks.
 */
export async function getActiveStockTickers(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from('fintra_active_stocks')
    .select('ticker')
    .eq('is_active', true)
    .eq('type', 'stock')
    .order('ticker', { ascending: true });

  if (error) {
    console.error('Error fetching active stock tickers:', error);
    throw error;
  }

  if (!data) return [];

  return data.map((row: any) => row.ticker);
}
