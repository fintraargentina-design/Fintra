import { supabaseAdmin } from '@/lib/supabase-admin';
import dayjs from 'dayjs';
import Papa from 'papaparse';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

interface PricesDailyBulkOptions {
  date?: string;
  ticker?: string;
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
  const stats = { processed: 0, inserted: 0, errors: 0, skipped: 0 };
  
  try {
    // 1. Resolve Date
    // Default to today. If user provided a date, use it.
    const targetDate = opts.date || dayjs().format('YYYY-MM-DD');
    log.push(`Target Date: ${targetDate}`);

    const PAGE_SIZE = 1000;
    const activeTickers = new Set<string>();
    let page = 0;

    while (true) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabaseAdmin
        .from('fintra_universe')
        .select('ticker')
        .eq('is_active', true)
        .order('ticker', { ascending: true })
        .range(from, to);

      if (error) throw new Error(`Universe fetch failed: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const d of data as any[]) {
        if (d?.ticker) activeTickers.add(String(d.ticker).toUpperCase());
      }

      if (data.length < PAGE_SIZE) break;
      page++;
    }

    log.push(`Active Universe: ${activeTickers.size} tickers loaded.`);
    if (activeTickers.size === 0) {
        log.push('WARNING: Active Universe is EMPTY!');
    }

    // 3. Download & Cache Strategy
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) throw new Error('Missing FMP_API_KEY');

    // Define Cache Path
    const cacheDir = path.join(process.cwd(), 'data', 'fmp-eod-bulk');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    const cacheFile = path.join(cacheDir, `eod_${targetDate}.csv`);
    
    let nodeStream: Readable;

    if (fs.existsSync(cacheFile)) {
        log.push(`✅ CACHE HIT: Found local CSV at ${cacheFile}`);
        nodeStream = fs.createReadStream(cacheFile);
    } else {
        log.push(`⬇️ CACHE MISS: Downloading EOD Bulk from FMP to ${cacheFile}...`);
        const url = `https://financialmodelingprep.com/stable/eod-bulk?date=${targetDate}&apikey=${apiKey}&datatype=csv`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`FMP EOD Bulk failed: ${response.status} ${response.statusText}`);
        }
        
        if (!response.body) {
            throw new Error('FMP returned empty body');
        }

        // Save to Disk first (Stream to file)
        const fileStream = fs.createWriteStream(cacheFile);
        // @ts-ignore
        await pipeline(Readable.fromWeb(response.body), fileStream);
        log.push(`✅ Download complete. Saved to ${cacheFile}`);

        // Read from the newly saved file
        nodeStream = fs.createReadStream(cacheFile);
    }

    // 4. Streaming Parse & Process

    
    const BATCH_SIZE = 1000;
    let batch: any[] = [];
    
    // Helper to flush batch
    const flushBatch = async (rowsToInsert: any[]) => {
        if (rowsToInsert.length === 0) return;
        
        const { error } = await supabaseAdmin
            .from('prices_daily')
            .upsert(rowsToInsert, { onConflict: 'ticker,price_date' });
            
        if (error) {
            log.push(`Batch upsert error: ${error.message}`);
            stats.errors += rowsToInsert.length;
        } else {
            stats.inserted += rowsToInsert.length;
        }
    };

    await new Promise<void>((resolve, reject) => {
        Papa.parse<EodRow>(nodeStream, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            step: (results, parser) => {
                try {
                    const row = results.data;
                    // Safe string conversion for symbol
                    const ticker = (row.symbol !== undefined && row.symbol !== null) 
                        ? String(row.symbol).toUpperCase() 
                        : null;

                    // FILTER: Active Universe
                    if (!ticker || !activeTickers.has(ticker)) {
                        stats.skipped++;
                        return;
                    }

                    // FILTER: Target Ticker (if debug/single mode)
                    if (opts.ticker && ticker !== opts.ticker.toUpperCase()) {
                         stats.skipped++;
                         return;
                    }
                    
                    // FILTER: Limit (Benchmark Mode)
                    if (opts.limit && stats.inserted >= opts.limit) {
                        parser.abort();
                        // resolve handled in complete/error? Abort triggers complete?
                        // PapaParse abort triggers complete? Usually yes.
                        return;
                    }

                    // QUALITY GATE
                    const open = row.open;
                    const high = row.high;
                    const low = row.low;
                    const close = row.close;
                    const adjClose = row.adjClose;
                    const volume = (row.volume !== null && row.volume !== undefined) 
                        ? Math.round(row.volume) 
                        : null;
                    
                    let isValid = true;
                    
                    if (volume === null || volume === undefined || volume <= 0) isValid = false;
                    if (adjClose === null || adjClose === undefined) isValid = false;
                    if (open === null || high === null || low === null || close === null) isValid = false;
                    
                    if (isValid) {
                        const maxOC = Math.max(open!, close!);
                        const minOC = Math.min(open!, close!);
                        if (high! < maxOC) isValid = false; 
                        if (low! > minOC) isValid = false; 
                    }

                    if (!isValid) {
                        stats.skipped++;
                        return;
                    }

                    // Map to DB
                    const dbRow = {
                        ticker: ticker,
                        price_date: row.date || targetDate, 
                        open: open,
                        high: high,
                        low: low,
                        close: close,
                        adj_close: adjClose,
                        volume: volume,
                        source: 'fmp_eod_bulk'
                    };
                    
                    batch.push(dbRow);
                    stats.processed++;
                    
                    // FLOW CONTROL: Only pause if batch is full
                    if (batch.length >= BATCH_SIZE) {
                        parser.pause();
                        const batchToInsert = [...batch];
                        batch = []; // Clear immediately for safety (though stream is paused)
                        
                        flushBatch(batchToInsert).then(() => {
                            parser.resume();
                        }).catch(err => {
                             console.error('Batch flush error:', err);
                             stats.errors += batchToInsert.length;
                             parser.resume(); // Resume even on error? Yes, to continue.
                        });
                    }
                    
                } catch (err) {
                    console.error('Row processing error:', err);
                    stats.errors++;
                }
            },
            complete: async () => {
                // Flush remaining
                if (batch.length > 0) {
                    await flushBatch(batch);
                }
                resolve();
            },
            error: (err) => {
                reject(err);
            }
        });
    });

    log.push(`Completed. Inserted: ${stats.inserted}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);

    return {
        success: true,
        date: targetDate,
        stats,
        log
    };

  } catch (err: any) {
      console.error('[PricesDailyBulk] Critical Error:', err);
      return {
          success: false,
          error: err.message,
          log,
          stats
      };
  }
}
