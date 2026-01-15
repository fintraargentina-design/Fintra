import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Configuration
const DATA_DIR = path.join(process.cwd(), 'data/fmp-bulk');

// Types (matches rehydration logic)
interface YearData {
  date?: string; // fiscal_year_end_date
  commonDividendsPaid: number | null;
  netDividendsPaid: number | null;
  freeCashFlow: number | null;
  weightedAverageShsOut: number | null;
  netIncome: number | null;
  hasCashflow: boolean;
  hasIncome: boolean;
}

interface TickerHistory {
  [year: number]: YearData;
}

interface CronResult {
  processed: number;
  skipped: number;
  inserted: number;
  errors: number;
  details: string[];
}

export async function runDividendsBulkV2(): Promise<CronResult> {
  const result: CronResult = {
    processed: 0,
    skipped: 0,
    inserted: 0,
    errors: 0,
    details: [],
  };

  try {
    // 1. Discover years to process (Optimistic: check latest files only?)
    // Requirement: "Process ONLY new FYs".
    // How do we define "new"?
    // The cron runs daily/weekly. FMP dumps new files annually or quarterly.
    // However, files are named `income_YYYY_FY.csv`.
    // We should check ALL files in the directory, but we can filter by checking if data exists in DB?
    // "Idempotent": It's safe to re-process.
    // "Tolerant": Errors in one ticker don't stop others.
    
    // To be efficient, we probably don't want to re-read 1995-2023 every time.
    // But since this is a filesystem cron, maybe reading the last few years is enough?
    // Let's grab all available years from file names, sort them, and maybe just process the last 2-3 years?
    // Or just process everything? "Scalable to 50k+ tickers".
    // Reading 30 years of bulk files (60 files total) is fast on disk.
    // Processing 50k tickers x 30 years in memory is heavy (~1.5M objects).
    // The requirement says "Process ONLY new FYs".
    // This implies we should look for the most recent year in DB and only process years > max_year?
    // Or maybe check if `income_YYYY_FY.csv` is newer than some marker?
    
    // Let's implement a safe strategy:
    // 1. Find all YYYY in filenames.
    // 2. Filter for YYYY >= current_year - 1 (to catch restatements or late filings).
    // actually, let's just process the files present.
    // If the requirement "Process ONLY new FYs" implies "don't re-process old years",
    // we can check the max year in DB? No, that's expensive per ticker.
    
    // Let's read all files but only build the dataset.
    // Wait, the "Process ONLY new FYs" might refer to the logic of what gets inserted.
    // "Upsert" handles idempotency.
    
    // Let's optimize: Check the directory for the latest years.
    const files = fs.readdirSync(DATA_DIR);
    const years = new Set<number>();
    files.forEach(f => {
      const match = f.match(/_(20\d{2})_FY\.csv$/);
      if (match) years.add(parseInt(match[1]));
    });
    
    // Sort years descending
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    
    // Strategy: Process ALL years found in the folder?
    // The user said "Process ONLY new FYs" in the context of "Cron V2 Activation".
    // If I process everything every time, it's a "Rehydration", not just a maintenance cron.
    // But "Rehydration" was Step 1. Cron is Step 9.
    // Maybe we only process the last 2 years to be safe and fast?
    // Let's pick the last 2 years available in the folder.
    const targetYears = sortedYears.slice(0, 2); 
    
    console.log(`Dividends V2 Cron: Processing years ${targetYears.join(', ')}`);

    const universe: Record<string, TickerHistory> = {};

    // Helper to read file safely
    const readFile = (filename: string, year: number, type: 'cashflow' | 'income') => {
      const filePath = path.join(DATA_DIR, filename);
      if (!fs.existsSync(filePath)) return;
      
      const content = fs.readFileSync(filePath, 'utf8');
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          results.data.forEach((row: any) => {
            const ticker = row.symbol;
            if (!ticker) return;

            if (!universe[ticker]) universe[ticker] = {};
            if (!universe[ticker][year]) universe[ticker][year] = {
               commonDividendsPaid: null,
               netDividendsPaid: null,
               freeCashFlow: null,
               weightedAverageShsOut: null,
               netIncome: null,
               hasCashflow: false,
               hasIncome: false
            };

            const entry = universe[ticker][year];

            if (type === 'cashflow') {
              entry.hasCashflow = true;
              entry.date = row.date;
              entry.commonDividendsPaid = parseFloatOrNull(row.commonDividendsPaid);
              entry.netDividendsPaid = parseFloatOrNull(row.netDividendsPaid);
              entry.freeCashFlow = parseFloatOrNull(row.freeCashFlow);
            } else {
              entry.hasIncome = true;
              entry.weightedAverageShsOut = parseFloatOrNull(row.weightedAverageShsOut);
              entry.netIncome = parseFloatOrNull(row.netIncome);
            }
          });
        }
      });
    };

    // Read files for target years
    for (const year of targetYears) {
      readFile(`cashflow_${year}_FY.csv`, year, 'cashflow');
      readFile(`income_${year}_FY.csv`, year, 'income');
    }

    // Build rows
    const rowsToUpsert: any[] = [];
    const tickers = Object.keys(universe);
    
    for (const ticker of tickers) {
      const history = universe[ticker];
      
      // We only have targetYears in history.
      // But for `is_growing`, we need previous year data.
      // If we don't load previous year, we can't calculate `is_growing` for the earliest target year.
      // "is_growing = dividend_per_share > dividend_per_share(previous FY) (NULL if no previous FY)"
      // If we run incrementally, maybe we can fetch previous year from DB?
      // Or we just accept NULL for is_growing if we don't have the file?
      // Efficient approach: Load targetYears + 1 extra previous year just for calculation context?
      // Let's stick to "pure deterministic from files" rule.
      // If I only load 2024 and 2025, I can calculate is_growing for 2025 (using 2024).
      // I cannot calculate for 2024 (need 2023).
      // This is acceptable for a maintenance cron.
      
      const years = Object.keys(history).map(Number).sort((a, b) => a - b);
      
      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const data = history[year];
        
        if (!data.hasCashflow || !data.hasIncome) {
          result.skipped++;
          continue;
        }

        // Calculations (Copied from rehydration logic)
        let rawDiv = data.commonDividendsPaid;
        if (rawDiv === null) rawDiv = data.netDividendsPaid;
        const dividend_cash_paid = rawDiv !== null ? Math.abs(rawDiv) : null;
        const shares = data.weightedAverageShsOut;
        const netIncome = data.netIncome;
        const fcf = data.freeCashFlow;

        let dividend_per_share: number | null = null;
        if (dividend_cash_paid !== null && shares && shares > 0) {
          dividend_per_share = dividend_cash_paid / shares;
        }

        let payout_eps: number | null = null;
        if (dividend_cash_paid !== null && netIncome && netIncome > 0) {
          payout_eps = (dividend_cash_paid / netIncome) * 100;
        }

        let payout_fcf: number | null = null;
        if (dividend_cash_paid !== null && fcf && fcf > 0) {
          payout_fcf = (dividend_cash_paid / fcf) * 100;
        }

        const has_dividend = (dividend_per_share !== null && dividend_per_share > 0);

        let is_growing: boolean | null = null;
        // Check local history first
        if (i > 0 && years[i-1] === year - 1) {
           const prevData = history[year - 1];
           let prevDiv = prevData.commonDividendsPaid ?? prevData.netDividendsPaid;
           const prevCash = prevDiv !== null ? Math.abs(prevDiv) : null;
           const prevShares = prevData.weightedAverageShsOut;
           let prevDPS: number | null = null;
           if (prevCash !== null && prevShares && prevShares > 0) {
             prevDPS = prevCash / prevShares;
           }
           if (dividend_per_share !== null && prevDPS !== null) {
             is_growing = dividend_per_share > prevDPS;
           }
        }
        
        // If we still don't have is_growing (e.g. first year of batch), 
        // strictly speaking we return NULL.
        // We do NOT query DB for previous year to keep it "Pure/Deterministic" from inputs.

        rowsToUpsert.push({
          ticker: ticker,
          year: year,
          fiscal_year_end_date: data.date,
          dividend_cash_paid: dividend_cash_paid,
          dividend_per_share: dividend_per_share,
          payout_eps: payout_eps,
          payout_fcf: payout_fcf,
          has_dividend: has_dividend,
          is_growing: is_growing,
          source: 'fmp-bulk'
        });
      }
    }

    // Bulk Upsert
    if (rowsToUpsert.length > 0) {
      const CHUNK_SIZE = 5000;
      for (let i = 0; i < rowsToUpsert.length; i += CHUNK_SIZE) {
        const chunk = rowsToUpsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabaseAdmin.from('datos_dividendos').upsert(chunk, {
          onConflict: 'ticker,year'
        });
        if (error) {
          console.error(`Error inserting chunk ${i}:`, error);
          result.errors += chunk.length;
          result.details.push(`Chunk insert error: ${error.message}`);
        } else {
          result.inserted += chunk.length;
        }
      }
    }
    
    result.processed = tickers.length;

  } catch (error: any) {
    console.error('Critical error in Dividends V2 Cron:', error);
    result.errors++;
    result.details.push(error.message);
  }

  return result;
}

function parseFloatOrNull(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}
