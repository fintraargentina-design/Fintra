import { supabaseAdmin } from '@/lib/supabase-admin';

// --- Main Core Function ---

export async function runPerformanceBulk(targetTicker?: string, limit?: number) {
  console.log('[PerformanceBulk] Starting pipeline (Strict SQL-backed)...');
  
  // 1. Get Universe
  let activeTickers: string[] = [];

  if (targetTicker) {
    console.log(`[PerformanceBulk] Running for single ticker: ${targetTicker}`);
    activeTickers = [targetTicker];
  } else {
    // We fetch all active tickers.
    let page = 0;
    const BATCH_SIZE = 1000;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from('fintra_universe')
        .select('ticker')
        .eq('is_active', true)
        .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      activeTickers.push(...data.map(t => t.ticker));
      if (data.length < BATCH_SIZE) break;
      page++;
    }
  }

  // LIMIT (Benchmark Mode)
  if (limit && limit > 0 && !targetTicker) {
      console.log(`🧪 BENCHMARK MODE: Limiting performance calc to first ${limit} tickers`);
      activeTickers = activeTickers.slice(0, limit);
  }

  console.log(`[PerformanceBulk] Universe size: ${activeTickers.length}`);

  let processed = 0;
  let failures = 0;

  // 2. Process Tickers
  // Chunking to control memory/concurrency
  const CONCURRENCY = 10;
  
  for (let i = 0; i < activeTickers.length; i += CONCURRENCY) {
    const chunk = activeTickers.slice(i, i + CONCURRENCY);
    
    await Promise.all(chunk.map(async (ticker) => {
      try {
        // Call the SQL function for each ticker
        // The function handles all calculations (Returns, Volatility, Drawdown) and UPSERTs
        const { error } = await supabaseAdmin.rpc('calculate_ticker_performance', {
          p_ticker: ticker
        });

        if (error) {
          console.error(`[PerformanceBulk] Error for ${ticker}:`, error.message);
          failures++;
        } else {
          processed++;
        }
      } catch (err) {
        console.error(`[PerformanceBulk] Exception for ${ticker}:`, err);
        failures++;
      }
    }));

    // Optional: Log progress every few chunks
    if ((i + CONCURRENCY) % 100 === 0) {
      console.log(`[PerformanceBulk] Progress: ${processed} processed, ${failures} failures`);
    }
  }

  console.log(`[PerformanceBulk] Completed. Processed: ${processed}, Failures: ${failures}`);
  
  return {
    processed,
    failures,
    total: activeTickers.length,
    timestamp: new Date().toISOString()
  };
}
