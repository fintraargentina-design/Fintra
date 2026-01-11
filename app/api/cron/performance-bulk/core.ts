import { supabaseAdmin } from '@/lib/supabase-admin';
import { pctReturn, volatility, maxDrawdown } from './utils';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

const WINDOWS = [
  { code: '1D', days: 1, ytd: false },
  { code: '1W', days: 5, ytd: false },
  { code: '1M', days: 21, ytd: false }, // Trading days approx
  { code: '3M', days: 63, ytd: false },
  { code: '6M', days: 126, ytd: false },
  { code: 'YTD', ytd: true, days: 0 },
  { code: '1Y', days: 252, ytd: false },
  { code: '3Y', days: 756, ytd: false },
  { code: '5Y', days: 1260, ytd: false }
];

export async function runPerformanceBulk() {
    console.log('[PerformanceBulk] Starting pipeline (SQL-backed)...');
    
    // 1. Get active universe from DB (with pagination)
    let activeTickers: string[] = [];
    let page = 0;
    const UNIVERSE_BATCH_SIZE = 1000;

    console.log('[PerformanceBulk] Fetching active universe...');
    while (true) {
      const { data: universeChunk, error: universeError } = await supabaseAdmin
        .from('fintra_universe')
        .select('ticker')
        .eq('is_active', true)
        .range(page * UNIVERSE_BATCH_SIZE, (page + 1) * UNIVERSE_BATCH_SIZE - 1);

      if (universeError) {
        console.error('[PerformanceBulk] Error fetching universe:', universeError);
        throw universeError;
      }

      if (!universeChunk || universeChunk.length === 0) break;
      
      activeTickers.push(...universeChunk.map(t => t.ticker));
      
      if (universeChunk.length < UNIVERSE_BATCH_SIZE) break;
      page++;
    }

    console.log(`[PerformanceBulk] Active universe size: ${activeTickers.length}`);
    
    let processedTickers = 0;
    let rowsInserted = 0;
    let rowsSkipped = 0;
    
    // 2. Process in Chunks to manage memory
    const CHUNK_SIZE = 50;
    
    for (let i = 0; i < activeTickers.length; i += CHUNK_SIZE) {
      const tickerChunk = activeTickers.slice(i, i + CHUNK_SIZE);
      
      // Fetch prices for this chunk from prices_daily
      const { data: pricesRaw, error: pricesError } = await supabaseAdmin
        .from('prices_daily')
        .select('ticker, price_date, close')
        .in('ticker', tickerChunk)
        .order('ticker', { ascending: true })
        .order('price_date', { ascending: true });

      if (pricesError) {
        console.error(`[PerformanceBulk] Error fetching prices for chunk ${i}:`, pricesError);
        continue;
      }

      if (!pricesRaw || pricesRaw.length === 0) {
        continue; // No prices for this chunk
      }

      // Group by ticker
      const pricesByTicker: Record<string, { date: string; close: number }[]> = {};
      for (const row of pricesRaw) {
        if (!pricesByTicker[row.ticker]) {
          pricesByTicker[row.ticker] = [];
        }
        pricesByTicker[row.ticker].push({
          date: row.price_date,
          close: Number(row.close)
        });
      }

      const rowsToUpsert: any[] = [];

      // Process each ticker in the chunk
      for (const ticker of tickerChunk) {
        const series = pricesByTicker[ticker];
        
        // Need at least 2 points to calculate any return (start -> end)
        if (!series || series.length < 2) {
          rowsSkipped += WINDOWS.length; 
          continue;
        }

        const lastPriceObj = series[series.length - 1];
        const lastPrice = lastPriceObj.close;
        const performanceDate = lastPriceObj.date;

        for (const w of WINDOWS) {
          let windowSeries: typeof series = [];

          if (w.ytd) {
            const ytdStart = dayjs(performanceDate).startOf('year');
            windowSeries = series.filter(p => 
              dayjs(p.date).isSameOrAfter(ytdStart) && 
              dayjs(p.date).isSameOrBefore(dayjs(performanceDate))
            );
          } else {
            // Trading days approximation
            const endIndex = series.length - 1;
            const startIndex = endIndex - w.days;
            
            if (startIndex < 0) {
               rowsSkipped++;
               continue;
            }
            
            windowSeries = series.slice(startIndex, endIndex + 1);
          }

          if (windowSeries.length < 2) {
              rowsSkipped++;
              continue;
          }

          const firstPrice = windowSeries[0].close;
          const prices = windowSeries.map(p => p.close);
          
          // Compute metrics
          const ret = pctReturn(firstPrice, lastPrice);

          // Daily returns for volatility
          const dailyReturns: number[] = [];
          for (let j = 1; j < prices.length; j++) {
               dailyReturns.push(pctReturn(prices[j-1], prices[j]));
          }

          rowsToUpsert.push({
            ticker,
            performance_date: performanceDate,
            window_code: w.code,
            return_percent: ret,
            absolute_return: lastPrice - firstPrice,
            volatility: volatility(dailyReturns),
            max_drawdown: maxDrawdown(prices),
            source: 'daily_prices_sql', // Updated source
            data_freshness: dayjs().diff(dayjs(performanceDate), 'day')
          });
          
          rowsInserted++;
        }
        processedTickers++;
      }

      // Upsert batch
      if (rowsToUpsert.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('datos_performance')
          .upsert(rowsToUpsert, { onConflict: 'ticker,performance_date,window_code' });
          
        if (upsertError) {
          console.error(`[PerformanceBulk] Error upserting batch for chunk ${i}:`, upsertError);
        }
      }
    }

    console.log(`[PerformanceBulk] Completed. Processed: ${processedTickers}, Inserted: ${rowsInserted}, Skipped: ${rowsSkipped}`);

    return {
      success: true,
      processedTickers,
      rowsInserted,
      rowsSkipped
    };
}
