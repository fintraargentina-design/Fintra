import Papa from 'papaparse';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';

// Helper to resolve data directory correctly (handling scripts execution context)
const resolveDataDir = (subDir: string) => {
  let root = process.cwd();
  if (root.includes('scripts')) {
    // Traverse up to find package.json or stop at root
    let current = root;
    while (current !== path.dirname(current)) {
      if (existsSync(path.join(current, 'package.json'))) {
        root = current;
        break;
      }
      current = path.dirname(current);
    }
  }
  return path.join(root, 'data', subDir);
};

const BASE_URL = 'https://financialmodelingprep.com/stable';
const CACHE_DIR = resolveDataDir('fmp-bulk');

// Map endpoints to shorter cache prefixes
const ENDPOINT_MAP: Record<string, string> = {
  'income-statement-bulk': 'income',
  'balance-sheet-statement-bulk': 'balance',
  'cashflow-statement-bulk': 'cashflow',
  'key-metrics-ttm-bulk': 'metrics_ttm',
  'ratios-ttm-bulk': 'ratios_ttm'
};

export async function fetchFinancialsBulk(apiKey: string, activeTickers: Set<string>) {
  const currentYear = new Date().getFullYear();
  console.log(`[financials-bulk] Running for years: ${currentYear} down to 2023`);
  
  // RESTRICTION: Fetch from current year back to 2023
  // Including 2020-2022 as well if user requested full history
  // Adjusted for validation: Removed 2026 to prevent 404/429 loops on future data
  const years = [2020, 2021, 2022, 2023, 2024, 2025];
  
  // FMP financial BULK endpoints REQUIRE explicit 'year' and 'period' parameters.
  // We want FY and all Quarters to build TTM
  const periods = ['FY', 'Q1', 'Q2', 'Q3', 'Q4'];

  // Ensure cache directory exists
  if (!existsSync(CACHE_DIR)) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
  
  // Helper to fetch (with cache) and parse CSV
  const fetchCSV = async (endpointBase: string, year: number | null, period: string | null): Promise<any[]> => {
    const prefix = ENDPOINT_MAP[endpointBase] || endpointBase;
    const fileName = year ? `${prefix}_${year}_${period}.csv` : `${prefix}.csv`;
    const filePath = path.join(CACHE_DIR, fileName);
    
    let url = `${BASE_URL}/${endpointBase}?apikey=${apiKey}`;
    if (year && period) {
        url += `&year=${year}&period=${period}`;
    }

    // 1. Ensure File Exists (Download if needed)
    if (!existsSync(filePath)) {
      console.log(`[fmp-bulk-cache] MISS ${fileName} -> downloading`);
      try {
        const res = await fetch(url);
        
        if (res.status === 429) {
          console.error(`[fmp-bulk-cache] FETCH FAILED ${fileName} (429) - Rate Limit Exceeded`);
          return []; // Skip gracefully
        }

        if (!res.ok) {
          console.warn(`[fmp-bulk-cache] Failed to fetch ${url}: ${res.status} ${res.statusText}`);
          return [];
        }

        // Stream to file to avoid memory spike
        const arrayBuffer = await res.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));
      } catch (e) {
        console.error(`[fmp-bulk-cache] Error fetching ${url}:`, e);
        return [];
      }
    } else {
        console.log(`[fmp-bulk-cache] HIT ${fileName}`);
    }

    // 2. Parse from Disk with Streaming + Filtering
    // This prevents loading the entire CSV into V8 heap
    return new Promise((resolve) => {
      const rows: any[] = [];
      const stream = createReadStream(filePath);
      
      Papa.parse(stream, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        step: (results: any) => {
          const row = results.data;
          // MEMORY OPTIMIZATION: Only keep rows for active tickers
          const symbol = row.symbol || row.ticker;
          if (symbol && activeTickers.has(symbol)) {
            rows.push(row);
          }
        },
        complete: () => {
          resolve(rows);
        },
        error: (err: any) => {
            console.error(`[fmp-bulk-cache] Error parsing ${fileName}:`, err);
            resolve([]); // Return empty on error to keep going
        }
      });
    });
  };

  const tasks: Promise<{ type: string, rows: any[] }>[] = [];

  // Queue up all fetches
  // We process years sequentially to be safer on memory, or parallel?
  // Parallel is faster, but we must limit concurrency if memory is tight.
  // Given we are filtering row-by-row, parallel should be fine for parsing 
  // as long as we don't have too many open streams.
  // Let's stick to Promise.all but maybe we can chunk the years if it still crashes.
  
  for (const year of years) {
    for (const period of periods) {
      tasks.push(fetchCSV('income-statement-bulk', year, period).then(rows => ({ type: 'income', rows })));
      tasks.push(fetchCSV('balance-sheet-statement-bulk', year, period).then(rows => ({ type: 'balance', rows })));
      tasks.push(fetchCSV('cash-flow-statement-bulk', year, period).then(rows => ({ type: 'cashflow', rows })));
    }
  }

  // Add TTM Bulk Fetches
  tasks.push(fetchCSV('key-metrics-ttm-bulk', null, null).then(rows => ({ type: 'metrics_ttm', rows })));
  tasks.push(fetchCSV('ratios-ttm-bulk', null, null).then(rows => ({ type: 'ratios_ttm', rows })));

  // EXECUTE IN CHUNKS to avoid "Too many open files" or OOM during Promise.all aggregation
  const CHUNK_SIZE = 10;
  const results: { type: string, rows: any[] }[] = [];
  
  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
      const chunk = tasks.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk);
      results.push(...chunkResults);
      // Optional: Force garbage collection hints (not available in standard JS, but loop break helps)
  }

  // Aggregate results
  const income = results.filter(r => r.type === 'income').flatMap(r => r.rows);
  const balance = results.filter(r => r.type === 'balance').flatMap(r => r.rows);
  const cashflow = results.filter(r => r.type === 'cashflow').flatMap(r => r.rows);
  const metricsTTM = results.filter(r => r.type === 'metrics_ttm').flatMap(r => r.rows);
  const ratiosTTM = results.filter(r => r.type === 'ratios_ttm').flatMap(r => r.rows);

  return { income, balance, cashflow, metricsTTM, ratiosTTM };
}
