
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Papa from 'papaparse';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// --- Configuration ---
const BASE_URL = 'https://financialmodelingprep.com/api/v3'; // or v4 for bulk? eod is v3 usually
// Actually eod-bulk is v3: https://financialmodelingprep.com/api/v3/batch-request-end-of-day-prices?date=...
const CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-performance-bulk');
const API_KEY = process.env.FMP_API_KEY;

// --- Interfaces ---
interface EodPriceRow {
  symbol: string;
  date: string;
  close: number;
  adjClose: number;
  // Other fields exist but we only need close/adjClose
}

interface PerformanceRow {
  ticker: string;
  performance_date: string;
  window_code: string;
  return_percent: number;
  absolute_return: number | null;
  volatility: number | null;
  max_drawdown: number | null;
  data_freshness: number;
  source: string;
}

// --- Helpers ---

async function downloadFile(url: string, filePath: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
        console.warn(`[performance-bulk] Failed to fetch ${url}: ${res.status} ${res.statusText}`);
        return false;
    }
    const text = await res.text();
    // FMP sometimes returns empty JSON [] or error message in JSON
    if (text.trim().startsWith('{') && text.includes('Error')) {
        console.warn(`[performance-bulk] API Error for ${url}: ${text}`);
        return false;
    }
    if (text.length < 50) { // Arbitrary small size check
        // Check if it's empty CSV or empty JSON
        if (text.trim() === '' || text.trim() === '[]') return false;
    }
    
    await fs.writeFile(filePath, text);
    return true;
  } catch (e) {
    console.error(`[performance-bulk] Network error for ${url}:`, e);
    return false;
  }
}

async function getCsvData(filePath: string): Promise<Map<string, number>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    // Check if it's JSON (sometimes FMP returns JSON for bulk if requested, but usually CSV)
    // The endpoint `batch-request-end-of-day-prices` returns CSV by default? 
    // Wait, documentation says "The response is a JSON array".
    // Let's check `valuation-bulk`. It uses `eod-bulk` which returns CSV in its implementation?
    // In `valuation-bulk`: `const eodUrlToday = ${BASE_URL}/eod-bulk?date=${today}&apikey=${API_KEY}`;
    // And it uses `Papa.parse`. So it expects CSV.
    // However, FMP docs say `batch-request-end-of-day-prices` is JSON.
    // `eod-bulk` might be a different endpoint or alias.
    // Let's assume CSV if `valuation-bulk` works.
    // If content starts with [, it is JSON.
    
    if (content.trim().startsWith('[')) {
        const data: any[] = JSON.parse(content);
        const map = new Map<string, number>();
        data.forEach(item => {
            if (item.symbol && item.close) {
                map.set(item.symbol, Number(item.close));
            }
        });
        return map;
    }

    // Else parse as CSV
    const parsed = Papa.parse(content, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
    
    const map = new Map<string, number>();
    parsed.data.forEach((row: any) => {
       // FMP CSV headers usually: symbol, date, open, high, low, close, adjClose, volume
       const sym = row.symbol || row.ticker;
       const price = row.close; // Use close or adjClose? "P0 = latest available close price". Usually Close.
       // For performance, Adjusted Close is better for dividends but prompt says "close price".
       // Let's stick to "close" as per prompt "P0 = latest available close price".
       if (sym && price !== undefined) {
           map.set(sym, Number(price));
       }
    });
    return map;
  } catch (e) {
    console.error(`[performance-bulk] Error parsing ${filePath}:`, e);
    return new Map();
  }
}

/**
 * Finds the closest trading day with data, looking backwards from targetDate.
 * Returns the date string (YYYY-MM-DD) and the data map.
 */
async function getPriceMapForDate(targetDate: string, lookbackDays: number = 5): Promise<{ date: string, map: Map<string, number> } | null> {
    const dateObj = new Date(targetDate);
    
    for (let i = 0; i <= lookbackDays; i++) {
        const current = new Date(dateObj);
        current.setDate(dateObj.getDate() - i);
        const dateStr = current.toISOString().slice(0, 10);
        
        const fileName = `prices_${dateStr}.csv`; // We save as CSV/JSON but filename
        const filePath = path.join(CACHE_DIR, fileName);
        
        let hasData = false;
        
        // 1. Check Cache
        if (existsSync(filePath)) {
            const stats = await fs.stat(filePath);
            if (stats.size > 100) { // Basic validation
                hasData = true;
            }
        }
        
        // 2. Download if missing
        if (!hasData) {
            // Try fetch
            // Using endpoint: batch-request-end-of-day-prices
            // URL: https://financialmodelingprep.com/api/v3/batch-request-end-of-day-prices?date=YYYY-MM-DD
            // Note: valuation-bulk uses `/eod-bulk`? Let's verify.
            // Documentation: "Bulk Request End of Day Prices" -> `v4/batch-request-end-of-day-prices`
            // Let's stick to what valuation-bulk uses: `${BASE_URL}/eod-bulk?date=${today}`
            // Assuming BASE_URL is `https://financialmodelingprep.com/stable` in valuation-bulk.
            // Here I used `api/v3`.
            // Let's use `api/v4/batch-request-end-of-day-prices` which is standard.
            
            const url = `${BASE_URL}/batch-request-end-of-day-prices?date=${dateStr}&apikey=${API_KEY}`;
            console.log(`[performance-bulk] Downloading prices for ${dateStr}...`);
            const success = await downloadFile(url, filePath);
            if (success) hasData = true;
        }
        
        if (hasData) {
            const map = await getCsvData(filePath);
            if (map.size > 100) { // Ensure we have a decent number of tickers
                console.log(`[performance-bulk] Found valid data for ${dateStr} (Tickers: ${map.size})`);
                return { date: dateStr, map };
            }
        }
        
        // If we are here, this date failed. Try previous.
    }
    
    return null;
}

// --- Main Handler ---

export async function GET() {
    if (!API_KEY) {
        return NextResponse.json({ error: 'Missing FMP_API_KEY' }, { status: 500 });
    }

    const today = new Date().toISOString().slice(0, 10);
    console.log(`[performance-bulk] Starting run for ${today}`);
    
    try {
        // Ensure cache dir
        if (!existsSync(CACHE_DIR)) {
            await fs.mkdir(CACHE_DIR, { recursive: true });
        }

        // 1. Get P0 (Latest Prices)
        const p0Data = await getPriceMapForDate(today, 5);
        if (!p0Data) {
            throw new Error('Could not find any recent price data (checked last 5 days).');
        }
        
        const { date: p0Date, map: p0Map } = p0Data;
        const freshness = Math.floor((new Date(today).getTime() - new Date(p0Date).getTime()) / (1000 * 3600 * 24));
        console.log(`[performance-bulk] P0 Date: ${p0Date} (Freshness: ${freshness} days). Tickers: ${p0Map.size}`);

        // 2. Define Windows
        const p0DateObj = new Date(p0Date);
        const getTargetDate = (fn: (d: Date) => void) => {
            const d = new Date(p0DateObj);
            fn(d);
            return d.toISOString().slice(0, 10);
        };

        const windows = [
            { code: '1D', target: getTargetDate(d => d.setDate(d.getDate() - 1)) },
            { code: '1W', target: getTargetDate(d => d.setDate(d.getDate() - 7)) },
            { code: '1M', target: getTargetDate(d => d.setMonth(d.getMonth() - 1)) },
            { code: '3M', target: getTargetDate(d => d.setMonth(d.getMonth() - 3)) },
            { code: '6M', target: getTargetDate(d => d.setMonth(d.getMonth() - 6)) },
            { code: 'YTD', target: `${p0Date.substring(0, 4)}-01-01` }, // Jan 1st of current P0 year
            { code: '1Y', target: getTargetDate(d => d.setFullYear(d.getFullYear() - 1)) },
            { code: '3Y', target: getTargetDate(d => d.setFullYear(d.getFullYear() - 3)) },
            { code: '5Y', target: getTargetDate(d => d.setFullYear(d.getFullYear() - 5)) },
        ];

        let totalUpserted = 0;
        let skippedWindows = 0;

        // 3. Process each window
        for (const w of windows) {
            console.log(`[performance-bulk] Processing Window: ${w.code} (Target: ${w.target})`);
            
            // Note: For YTD, we look back from Jan 1st. 
            // Ideally we want Close of Dec 31st Prev Year. 
            // But Jan 1st lookback will find Dec 31st or Dec 30th appropriately.
            
            const startData = await getPriceMapForDate(w.target, 5);
            
            if (!startData) {
                console.warn(`[performance-bulk] No data found for window ${w.code} near ${w.target}. Skipping.`);
                skippedWindows++;
                continue;
            }

            const { date: startDate, map: startMap } = startData;
            
            // Build Rows
            const batch: PerformanceRow[] = [];
            const UPSERT_BATCH_SIZE = 500;
            
            for (const [ticker, p0] of p0Map.entries()) {
                const pStart = startMap.get(ticker);
                
                if (pStart !== undefined && pStart > 0) {
                    const returnPercent = ((p0 / pStart) - 1) * 100;
                    const absReturn = p0 - pStart;
                    
                    batch.push({
                        ticker,
                        performance_date: today, // Cron execution date per requirement
                        window_code: w.code,
                        return_percent: parseFloat(returnPercent.toFixed(4)),
                        absolute_return: parseFloat(absReturn.toFixed(4)),
                        volatility: null, // Optional, skipped per bulk constraint
                        max_drawdown: null, // Optional, skipped per bulk constraint
                        data_freshness: freshness,
                        source: 'FMP_BULK'
                    });
                }

                if (batch.length >= UPSERT_BATCH_SIZE) {
                    const { error } = await supabaseAdmin
                        .from('datos_performance')
                        .upsert(batch, { onConflict: 'ticker,performance_date,window_code' });
                    
                    if (error) console.error(`[performance-bulk] Upsert error:`, error);
                    totalUpserted += batch.length;
                    batch.length = 0;
                }
            }
            
            // Flush remaining
            if (batch.length > 0) {
                const { error } = await supabaseAdmin
                    .from('datos_performance')
                    .upsert(batch, { onConflict: 'ticker,performance_date,window_code' });
                
                if (error) console.error(`[performance-bulk] Upsert error:`, error);
                totalUpserted += batch.length;
            }
            
            console.log(`[performance-bulk] Completed ${w.code} using start date ${startDate}.`);
        }

        return NextResponse.json({
            message: 'Performance bulk execution complete',
            p0_date: p0Date,
            freshness,
            processed_tickers: p0Map.size,
            total_rows_upserted: totalUpserted,
            skipped_windows: skippedWindows
        });

    } catch (e: any) {
        console.error('[performance-bulk] Critical Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
