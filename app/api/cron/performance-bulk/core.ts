import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';

// --- Main Core Function ---

export async function runPerformanceBulk(targetTicker?: string, limit?: number) {
  console.log('[PerformanceBulk] Starting pipeline (Strict SQL-backed)...');
  
  // 1. Get Universe
  let activeTickers: string[] = [];

  if (targetTicker) {
    console.log(`[PerformanceBulk] Running for single ticker: ${targetTicker}`);
    activeTickers = [targetTicker];
  } else {
    // We fetch all active tickers using the central repository logic
    console.log('[PerformanceBulk] Fetching active stocks from fintra_active_stocks...');
    activeTickers = await getActiveStockTickers(supabaseAdmin);
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
  // LOWERED CONCURRENCY to avoid "statement timeout" in Postgres (heavy window functions)
  const CONCURRENCY = 3;
  
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
