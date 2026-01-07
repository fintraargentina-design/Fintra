
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
  let allTickers: string[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('fintra_active_stocks')
      .select('ticker')
      .eq('is_active', true)
      .eq('type', 'stock')
      .order('ticker', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('Error fetching active stock tickers:', error);
      throw error;
    }

    if (!data || data.length === 0) break;

    const tickers = data.map((row: any) => row.ticker);
    allTickers = allTickers.concat(tickers);

    if (data.length < PAGE_SIZE) break;

    page++;
  }

  return allTickers;
}
