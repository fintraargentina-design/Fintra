import Papa from 'papaparse';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const BASE_URL = 'https://financialmodelingprep.com/stable';
const CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-bulk');

// Map endpoints to shorter cache prefixes
const ENDPOINT_MAP: Record<string, string> = {
  'income-statement-bulk': 'income',
  'balance-sheet-statement-bulk': 'balance',
  'cashflow-statement-bulk': 'cashflow'
};

export async function fetchFinancialsBulk(apiKey: string) {
  console.log('[financials-bulk] Running in CLOSED-YEAR MODE (2024 only)');
  
  // RESTRICTION: Lock to 2024 Closed Year
  const years = [2024];
  
  // FMP financial BULK endpoints REQUIRE explicit 'year' and 'period' parameters.
  // We want FY and all Quarters to build TTM
  const periods = ['FY', 'Q1', 'Q2', 'Q3', 'Q4'];

  // Ensure cache directory exists
  if (!existsSync(CACHE_DIR)) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
  
  // Helper to fetch (with cache) and parse CSV
  const fetchCSV = async (endpointBase: string, year: number, period: string) => {
    const prefix = ENDPOINT_MAP[endpointBase] || endpointBase;
    const fileName = `${prefix}_${year}_${period}.csv`;
    const filePath = path.join(CACHE_DIR, fileName);
    const url = `${BASE_URL}/${endpointBase}?year=${year}&period=${period}&apikey=${apiKey}`;

    let csvContent: string | null = null;
    let loadedFromCache = false;

    // 1. Check Cache
    try {
      if (existsSync(filePath)) {
        // In CLOSED-YEAR MODE, we trust the cache indefinitely (no isToday check)
        // to prevent unnecessary re-fetching of static 2024 data.
        csvContent = await fs.readFile(filePath, 'utf-8');
        loadedFromCache = true;
        console.log(`[fmp-bulk-cache] HIT ${fileName}`);
      }
    } catch (err) {
      console.warn(`[fmp-bulk-cache] Error checking cache for ${fileName}:`, err);
    }

    // 2. Network Fetch if MISS
    if (!csvContent) {
      console.log(`[fmp-bulk-cache] MISS ${fileName} -> downloading`);
      try {
        const res = await fetch(url);
        
        if (res.status === 429) {
          console.error(`[fmp-bulk-cache] FETCH FAILED ${fileName} (429) - Rate Limit Exceeded`);
          return []; // Skip gracefully
        }

        if (!res.ok) {
          // Some periods might not exist yet, warn but continue
          console.warn(`[fmp-bulk-cache] Failed to fetch ${url}: ${res.status} ${res.statusText}`);
          return [];
        }

        csvContent = await res.text();
        
        // 3. Save to Cache (only if successful)
        try {
            if (csvContent && csvContent.length > 0) {
                await fs.writeFile(filePath, csvContent, 'utf-8');
            }
        } catch (writeErr) {
            console.error(`[fmp-bulk-cache] Failed to write cache for ${fileName}:`, writeErr);
        }

      } catch (e) {
        console.error(`[fmp-bulk-cache] Error fetching ${url}:`, e);
        return [];
      }
    }

    // 4. Parse (Identical behavior for disk vs network)
    if (!csvContent) return [];

    try {
      const parsed = Papa.parse(csvContent, { 
        header: true, 
        skipEmptyLines: true,
        dynamicTyping: true // Convert numbers automatically
      });
      return parsed.data as any[];
    } catch (parseErr) {
      console.error(`[fmp-bulk-cache] Error parsing CSV for ${fileName}:`, parseErr);
      return [];
    }
  };

  const tasks: Promise<{ type: string, rows: any[] }>[] = [];

  // Queue up all fetches
  for (const year of years) {
    for (const period of periods) {
      tasks.push(fetchCSV('income-statement-bulk', year, period).then(rows => ({ type: 'income', rows })));
      tasks.push(fetchCSV('balance-sheet-statement-bulk', year, period).then(rows => ({ type: 'balance', rows })));
      tasks.push(fetchCSV('cash-flow-statement-bulk', year, period).then(rows => ({ type: 'cashflow', rows })));
    }
  }

  const results = await Promise.all(tasks);

  // Aggregate results
  const income = results.filter(r => r.type === 'income').flatMap(r => r.rows);
  const balance = results.filter(r => r.type === 'balance').flatMap(r => r.rows);
  const cashflow = results.filter(r => r.type === 'cashflow').flatMap(r => r.rows);

  return { income, balance, cashflow };
}
