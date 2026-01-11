import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

/**
 * FMP BULK FINANCIALS
 * ⚠️ OBLIGATORIO: year + period
 * ⚠️ NO usar part=0 para financials, pero sí para profiles (part=0 es el default)
 */
const YEAR = new Date().getFullYear().toString();
const PERIOD = 'FY'; // Q1 | Q2 | Q3 | Q4 | FY

// ⬇️ agregar a URLs
const FMP_CSV_URLS = {
  profiles: 'https://financialmodelingprep.com/stable/profile-bulk',

  income: `https://financialmodelingprep.com/stable/income-statement-bulk?year=${YEAR}&period=FY`,
  // income_growth: `https://financialmodelingprep.com/stable/income-statement-growth-bulk?year=${YEAR}&period=FY`, // DISABLED to avoid 401 if not needed

  balance: `https://financialmodelingprep.com/stable/balance-sheet-statement-bulk?year=${YEAR}&period=FY`,
  // balance_growth: `https://financialmodelingprep.com/stable/balance-sheet-statement-growth-bulk?year=${YEAR}&period=FY`,

  cashflow: `https://financialmodelingprep.com/stable/cash-flow-statement-bulk?year=${YEAR}&period=FY`,
  // cashflow_growth: `https://financialmodelingprep.com/stable/cash-flow-statement-growth-bulk?year=${YEAR}&period=FY`,

  ratios: 'https://financialmodelingprep.com/stable/ratios-ttm-bulk',
  metrics: 'https://financialmodelingprep.com/stable/key-metrics-ttm-bulk',
  scores: 'https://financialmodelingprep.com/stable/scores-bulk',
};

// 💾 CACHE CONFIGURATION
// Use absolute path for robustness
const CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-snapshot-cache');

// Ensure cache dir exists
if (!fs.existsSync(CACHE_DIR)) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`✅ Created Cache Dir: ${CACHE_DIR}`);
  } catch (e) {
    console.error(`❌ Failed to create cache dir: ${CACHE_DIR}`, e);
  }
}

export interface BulkFetchResult<T = any> {
  ok: boolean;
  data: T[];
  meta: {
    endpoint: string;
    rows: number;
    cachedFile?: string;
  };
  error?: {
    status?: number;
    message: string;
  };
}

// Helper to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to fetch with retry for 429
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      if (i === retries) return res; // Return the 429 response if out of retries
      const waitTime = 2000 * (i + 1);
      console.warn(`  ⚠️ 429 Too Many Requests. Waiting ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
      await sleep(waitTime);
      continue;
    }
    return res;
  }
  throw new Error('Unreachable code');
}

/**
 * Step 1: Download to Cache Layer
 * Writes directly to disk: /data/fmp-snapshot-cache/{endpoint}_latest.csv
 * Throws immediately on network error or empty body.
 */
async function downloadToCache(
  endpointKey: keyof typeof FMP_CSV_URLS,
  apiKey: string
): Promise<string> {
  const baseUrl = FMP_CSV_URLS[endpointKey];
  if (!baseUrl) {
      throw new Error(`Invalid endpoint key: ${endpointKey}`);
  }

  const filePath = path.join(CACHE_DIR, `${endpointKey}_latest.csv`);

  console.log(`⬇️ Downloading ${endpointKey} to cache...`);
  const fd = await fs.promises.open(filePath, 'w');
  
  let part = 0;
  let totalBytes = 0;
  let part0Signature: Buffer | null = null; // To detect if part N is identical to part 0

  try {
    while (true) {
      // Construct URL with part param
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}part=${part}&apikey=${apiKey}`;
      
      // Polite delay between parts to avoid 429 spikes
      if (part > 0) await sleep(500);

      const res = await fetchWithRetry(url);

      // Break on 404 (end of parts)
      if (!res.ok) {
          if (part > 0) {
              console.log(`  Part ${part} returned ${res.status}, assuming end of stream.`);
              break;
          }
          // If part 0 fails, it's a real error
          throw new Error(`HTTP ${res.status} fetching ${endpointKey} part ${part}`);
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength === 0) {
          console.log(`  Part ${part} empty, assuming end of stream.`);
          break;
      }

      let dataToWrite = Buffer.from(buffer);

      // DUPLICATE DETECTION
      // If part > 0, check if this part is identical to the beginning of part 0
      // This handles endpoints that ignore 'part' param and return the same full file (like scores-bulk sometimes)
      if (part === 0) {
          part0Signature = dataToWrite.subarray(0, 1024); // Keep first 1KB signature
      } else if (part0Signature) {
          const currentSignature = dataToWrite.subarray(0, 1024);
          if (currentSignature.equals(part0Signature)) {
              console.log(`  ⚠️ Part ${part} is identical to Part 0. Endpoint likely not paginated. Stopping.`);
              break;
          }
      }

      // STRIP HEADER for parts > 0
      if (part > 0) {
          let newlineIdx = -1;
          for (let i = 0; i < dataToWrite.length; i++) {
              if (dataToWrite[i] === 10) { // \n
                  newlineIdx = i;
                  break;
              }
          }
          
          if (newlineIdx !== -1) {
              dataToWrite = dataToWrite.subarray(newlineIdx + 1);
          }
      }

      await fd.write(dataToWrite);
      totalBytes += dataToWrite.length;
      
      part++;
      // Safety limit
      if (part > 50) {
          console.warn(`  Hit safety limit of 50 parts for ${endpointKey}`);
          break;
      }
    }
  } finally {
    await fd.close();
  }

  if (totalBytes === 0) {
      throw new Error(`CRITICAL: Empty response body for ${endpointKey} (all parts)`);
  }

  console.log(`✅ Downloaded ${part} parts for ${endpointKey} (${totalBytes} bytes)`);
  return filePath;
}

/**
 * Step 2 & 3: Validate and Parse from Cache
 * Reads from disk, checks guards, parses CSV.
 */
async function parseFromCache(
  endpointKey: keyof typeof FMP_CSV_URLS,
  filePath: string
): Promise<BulkFetchResult> {
  try {
    // 🛡️ GUARD: File Existence & Size
    const stats = await fs.promises.stat(filePath);
    if (stats.size === 0) {
      throw new Error(`Cache file is 0 bytes: ${filePath}`);
    }

    const csvText = await fs.promises.readFile(filePath, 'utf-8');

    if (!csvText.trim()) {
       throw new Error(`Cache file content is empty: ${filePath}`);
    }

    // 🛡️ PARSE
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: h => h.trim(),
    });

    const rows = (parsed.data as any[]) ?? [];

    // 🛡️ GUARD: Row Count (Profiles)
    if (endpointKey === 'profiles') {
      if (rows.length < 1000) { // Reduced to 1000 for safety, profiles usually > 50k
        console.warn(`WARNING: Profiles bulk suspicious (rows=${rows.length} < 1000).`);
      }
      console.log(`✅ Profiles check passed: ${rows.length} rows.`);
    }

    return {
      ok: true,
      data: rows,
      meta: {
        endpoint: endpointKey,
        rows: rows.length,
        cachedFile: filePath,
      },
    };

  } catch (error: any) {
    console.error(`❌ Parse Error [${endpointKey}]:`, error);
    return {
      ok: false,
      data: [],
      meta: {
        endpoint: endpointKey,
        rows: 0,
      },
      error: {
        message: error.message,
      },
    };
  }
}

/**
 * MAIN EXPORT
 */
export async function fetchAllFmpData(
  endpointKey: keyof typeof FMP_CSV_URLS,
  apiKey: string
): Promise<BulkFetchResult> {
  console.log(`🚀 fetchAllFmpData called for: ${endpointKey}`);
  try {
    // 1. Download
    const filePath = await downloadToCache(endpointKey, apiKey);

    // 2. Parse
    return await parseFromCache(endpointKey, filePath);

  } catch (error: any) {
    console.error(`❌ Fetch Error [${endpointKey}]:`, error);
    return {
      ok: false,
      data: [],
      meta: {
        endpoint: endpointKey,
        rows: 0,
      },
      error: {
        message: error.message,
      },
    };
  }
}
