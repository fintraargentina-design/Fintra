import { supabaseAdmin } from '@/lib/supabase-admin';
import dayjs from 'dayjs';

interface PriceRow {
  date: string;
  close: number;
}

interface WindowDef {
  code: string;
  ytd: boolean;
  years?: number;
  months?: number;
  days?: number;
}

const WINDOWS: WindowDef[] = [
  { code: '1D', ytd: false, days: 1 },
  { code: '1W', ytd: false, days: 7 },
  { code: '1M', ytd: false, months: 1 },
  { code: '3M', ytd: false, months: 3 },
  { code: '6M', ytd: false, months: 6 },
  { code: 'YTD', ytd: true },
  { code: '1Y', ytd: false, years: 1 },
  { code: '3Y', ytd: false, years: 3 },
  { code: '5Y', ytd: false, years: 5 },
];

// --- Helpers ---

/**
 * Price Loader
 * Input: ticker
 * Output: ordered array of { date, close }
 * If empty -> return empty array
 * If Supabase error -> throw
 */
async function loadPrices(ticker: string): Promise<PriceRow[]> {
  const { data, error } = await supabaseAdmin
    .from('prices_daily')
    .select('price_date, close')
    .eq('ticker', ticker)
    .order('price_date', { ascending: true });

  if (error) {
    throw new Error(`Supabase error loading prices for ${ticker}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((d: any) => ({
    date: d.price_date,
    close: Number(d.close),
  }));
}

function simpleReturn(start: number, end: number): number {
  if (start === 0) return 0;
  return (end / start) - 1;
}

function annualizedVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0 && curr > 0) {
      logReturns.push(Math.log(curr / prev));
    } else {
      logReturns.push(0);
    }
  }

  if (logReturns.length === 0) return 0;

  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  // Use sample variance (n-1)
  const variance = logReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (logReturns.length - 1 || 1);
  
  return Math.sqrt(variance) * Math.sqrt(252);
}

function maxDrawdown(prices: number[]): number {
  if (prices.length === 0) return 0;
  
  let peak = -Infinity;
  let minDrawdown = 0; // "Result must be negative or zero"

  for (const price of prices) {
    if (price > peak) {
      peak = price;
    }
    
    if (peak > 0) {
      const dd = (price / peak) - 1;
      if (dd < minDrawdown) {
        minDrawdown = dd;
      }
    }
  }
  
  return minDrawdown;
}

function getTargetStartDate(endDate: string, window: WindowDef): string {
  const d = dayjs(endDate);
  
  if (window.ytd) {
    return d.startOf('year').format('YYYY-MM-DD');
  }
  
  if (window.years) return d.subtract(window.years, 'year').format('YYYY-MM-DD');
  if (window.months) return d.subtract(window.months, 'month').format('YYYY-MM-DD');
  if (window.days) return d.subtract(window.days, 'day').format('YYYY-MM-DD');
  
  return d.format('YYYY-MM-DD');
}

/**
 * Validates if the found start price is appropriate for the requested window.
 * Rules:
 * - end > start
 * - YTD: Start must be in January
 * - Others: Start must be within reasonable tolerance of target (e.g. 1 month) to ensure "sufficient history"
 */
function isValidWindow(
  startPriceDate: string, 
  endPriceDate: string, 
  window: WindowDef, 
  targetStartDate: string
): boolean {
  const start = dayjs(startPriceDate);
  const end = dayjs(endPriceDate);
  const target = dayjs(targetStartDate);

  // 1. end_date > start_date
  if (!end.isAfter(start)) return false;

  // 2. YTD validation
  if (window.ytd) {
    // "YTD without January price -> invalid"
    if (start.month() !== 0) return false;
  } else if (window.code !== '1D') {
    // 3. Sufficient history check for long windows
    // "5Y without sufficient history -> invalid"
    // Tolerance: 30 days (approx 1 month)
    const diffDays = start.diff(target, 'day');
    if (diffDays > 30) return false;
  }

  return true;
}

// --- Main Core Function ---

export async function runPerformanceBulk(targetTicker?: string) {
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

  console.log(`[PerformanceBulk] Universe size: ${activeTickers.length}`);

  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  // 2. Process Tickers
  // Chunking to control memory/concurrency manually since p-limit is unavailable
  const CONCURRENCY = 10;
  
  for (let i = 0; i < activeTickers.length; i += CONCURRENCY) {
    const chunk = activeTickers.slice(i, i + CONCURRENCY);
    
    await Promise.all(chunk.map(async (ticker) => {
      try {
        // Load Prices
        const prices = await loadPrices(ticker);

        // "If less than 2 prices -> skip ticker"
        if (prices.length < 2) {
          skipped += WINDOWS.length;
          return;
        }

        const lastPriceRow = prices[prices.length - 1];
        const lastPrice = lastPriceRow.close;
        const performanceDate = lastPriceRow.date;

        const rowsToUpsert = [];

        for (const w of WINDOWS) {
          // Window Resolution
          const targetStartDate = getTargetStartDate(performanceDate, w);
          
          // "Do NOT approximate nearest values beyond first valid >= start date"
          // Find first price where date >= targetStartDate
          const startIndex = prices.findIndex(p => p.date >= targetStartDate);

          if (startIndex === -1) {
            // No valid start price found (target is after all data?)
            continue;
          }

          const startPriceRow = prices[startIndex];
          
          // Window Validation
          if (!isValidWindow(startPriceRow.date, performanceDate, w, targetStartDate)) {
            continue;
          }

          // Slice prices for calculations (inclusive)
          // "Annualized Volatility... Use log returns" -> needs series
          // "Max Drawdown... Peak-to-trough" -> needs series
          const windowPrices = prices.slice(startIndex); // to end
          
          // Compute Metrics
          // Return: (end / start) - 1
          const retDecimal = simpleReturn(startPriceRow.close, lastPrice);
          
          // Volatility
          const volDecimal = annualizedVolatility(windowPrices.map(p => p.close));
          
          // Max Drawdown
          const ddDecimal = maxDrawdown(windowPrices.map(p => p.close));

          // Prepare Row
          // Note: Storing as PERCENTAGE to match inferred DB contract (return_percent column)
          rowsToUpsert.push({
            ticker,
            performance_date: performanceDate,
            window_code: w.code,
            return_percent: retDecimal * 100,
            absolute_return: lastPrice - startPriceRow.close,
            volatility: volDecimal * 100,
            max_drawdown: ddDecimal * 100, // Negative percentage
            source: 'daily_prices_sql',
            data_freshness: dayjs().diff(dayjs(performanceDate), 'day')
          });
        }

        if (rowsToUpsert.length > 0) {
          const { error } = await supabaseAdmin
            .from('datos_performance')
            .upsert(rowsToUpsert, { onConflict: 'ticker,performance_date,window_code' });
          
          if (error) {
            console.error(`[PerformanceBulk] Upsert error for ${ticker}:`, error);
          } else {
            inserted += rowsToUpsert.length;
          }
        }
        
        processed++;

      } catch (err) {
        console.error(`[PerformanceBulk] Error processing ${ticker}:`, err);
        // "Un error en un ticker no frena el loop" -> Caught here.
      }
    }));
  }

  console.log(`[PerformanceBulk] Completed. Processed: ${processed}, Inserted: ${inserted}, Skipped: ${skipped}`);
  
  return { 
    success: true, 
    processed, 
    inserted, 
    skipped 
  };
}
