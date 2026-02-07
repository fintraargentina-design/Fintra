// Prices Daily Bulk core.ts
// This script downloads daily prices for all active tickers in the universe.
import { supabaseAdmin } from '@/lib/supabase-admin';
import dayjs from 'dayjs';
import Papa from 'papaparse';
import { Readable } from 'stream';

export interface PricesDailyBulkStats {
  processed: number;
  inserted: number;
  errors: number;
  skipped: number;
  duplicates: number;
}

interface PricesDailyBulkOptions {
  date?: string;
  ticker?: string; // Ticker filter usually not supported by bulk endpoint, but we can filter in memory
  limit?: number;
}

interface EodRow {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjClose: number | null;
  volume: number | null;
}

export async function runPricesDailyBulk(opts: PricesDailyBulkOptions) {
  const log: string[] = [];
  const aggregateStats = { processed: 0, inserted: 0, errors: 0, skipped: 0, duplicates: 0 };
  const FMP_API_KEY = process.env.FMP_API_KEY;

  if (!FMP_API_KEY) {
      return { success: false, error: "Missing FMP_API_KEY", log, stats: aggregateStats };
  }

  try {
    // 0. Determine Dates to Process
    const todayStr = dayjs().format('YYYY-MM-DD');
    let datesToProcess: string[] = [];

    if (opts.date) {
      // Manual Override
      datesToProcess = [opts.date];
      log.push(`Manual mode: Processing specific date ${opts.date}`);
    } else {
      // Auto Mode: "Smart Gap Fill"
      // Check SPY as proxy
      const { data: lastEntry, error: lastError } = await supabaseAdmin
        .from('prices_daily')
        .select('price_date')
        .eq('ticker', 'SPY')
        .order('price_date', { ascending: false })
        .limit(1)
        .single();

      if (lastError && lastError.code !== 'PGRST116') {
         log.push(`Warning: Could not fetch last date for SPY: ${lastError.message}`);
         datesToProcess = [todayStr];
      } else {
         const lastDate = lastEntry?.price_date;
         
         if (!lastDate) {
            log.push(`System appears empty. Defaulting to Today: ${todayStr}`);
            datesToProcess = [todayStr];
         } else {
            const last = dayjs(lastDate);
            const today = dayjs(todayStr);
            const diff = today.diff(last, 'day');

            if (diff === 0) {
                log.push(`✅ System is up to date (SPY found for ${todayStr}). No action needed.`);
            } else if (diff > 0) {
                const MAX_BACKFILL = 5;
                const daysToFill = Math.min(diff, MAX_BACKFILL);
                
                if (diff > MAX_BACKFILL) {
                    log.push(`⚠️ Gap of ${diff} days detected. Capping backfill to last ${MAX_BACKFILL} days.`);
                } else {
                    log.push(`🔄 Gap detected. Catching up ${daysToFill} days.`);
                }

                for (let i = 1; i <= daysToFill; i++) {
                     datesToProcess.push(last.add(i, 'day').format('YYYY-MM-DD'));
                }
            } else {
                log.push(`Future date detected in DB (${lastDate}). Checking Today anyway.`);
                datesToProcess = [todayStr];
            }
         }
      }
    }

    if (datesToProcess.length === 0) {
        return {
            success: true,
            date: todayStr,
            stats: aggregateStats,
            log
        };
    }

    // 1. Fetch Active Universe (Reuse for all dates)
    log.push(`Fetching active universe...`);
    const { data: activeRows } = await supabaseAdmin
        .from('fintra_active_stocks') 
        .select('ticker')
        .eq('is_active', true);
    
    const activeTickers = new Set<string>(activeRows?.map(r => r.ticker) || []);
    log.push(`Active universe size: ${activeTickers.size}`);

    // 2. Process Each Date
    for (const targetDate of datesToProcess) {
        log.push(`\n--- Processing Date: ${targetDate} ---`);
        
        const url = `https://financialmodelingprep.com/api/v4/batch-request-end-of-day-prices?date=${targetDate}&apikey=${FMP_API_KEY}`;
        
        // Fetch CSV stream
        const response = await fetch(url);
        if (!response.ok) {
            log.push(`❌ Failed to fetch FMP data for ${targetDate}: ${response.statusText}`);
            aggregateStats.errors++;
            continue;
        }

        const csvText = await response.text();
        
        // Parse CSV
        const parseResult = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true 
        });

        const rows = parseResult.data as EodRow[];
        log.push(`Downloaded ${rows.length} rows from FMP.`);

        if (rows.length === 0) {
            log.push(`No data found in FMP response for ${targetDate}.`);
            continue;
        }

        // Filter and Map
        const rowsToInsert: any[] = [];
        let skippedCount = 0;

        for (const row of rows) {
            if (!activeTickers.has(row.symbol)) {
                skippedCount++;
                continue;
            }

            // Map to DB schema
            rowsToInsert.push({
                ticker: row.symbol,
                price_date: targetDate, 
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
                volume: row.volume,
                adj_close: row.adjClose || row.close 
            });
        }

        log.push(`Filtered to ${rowsToInsert.length} active tickers (${skippedCount} skipped).`);

        // Batch Upsert
        const BATCH_SIZE = 1000;
        const chunks: any[][] = [];
        for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
            chunks.push(rowsToInsert.slice(i, i + BATCH_SIZE));
        }

        log.push(`Upserting ${rowsToInsert.length} rows in ${chunks.length} parallel chunks...`);

        await Promise.all(
            chunks.map(async (batch, idx) => {
                const { data, error } = await supabaseAdmin
                    .from('prices_daily')
                    .upsert(batch, { onConflict: 'ticker,price_date', ignoreDuplicates: true })
                    .select('ticker'); // Select to count actual inserts
                
                if (error) {
                    log.push(`❌ Batch upsert error (chunk ${idx + 1}): ${error.message}`);
                    aggregateStats.errors += batch.length;
                } else {
                    const insertedCount = data ? data.length : 0;
                    const duplicateCount = batch.length - insertedCount;
                    
                    aggregateStats.inserted += insertedCount;
                    aggregateStats.duplicates += duplicateCount;
                    aggregateStats.processed += batch.length;
                }
            })
        );
        
        log.push(`Finished ${targetDate}: ${aggregateStats.inserted} inserted, ${aggregateStats.duplicates} duplicates.`);
    }

    return {
        success: true,
        stats: aggregateStats,
        log
    };

  } catch (err: any) {
      console.error('[PricesDailyBulk] Critical Error:', err);
      log.push(`Critical Error: ${err.message}`);
      return {
          success: false,
          error: err.message,
          log,
          stats: aggregateStats
      };
  }
}
