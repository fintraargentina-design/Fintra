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
  profiles: 'https://financialmodelingprep.com/stable/profile-bulk?part=0',

  income: `https://financialmodelingprep.com/stable/income-statement-bulk?year=${YEAR}&period=FY`,
  income_growth: `https://financialmodelingprep.com/stable/income-statement-growth-bulk?year=${YEAR}&period=FY`,

  balance: `https://financialmodelingprep.com/stable/balance-sheet-statement-bulk?year=${YEAR}&period=FY`,
  balance_growth: `https://financialmodelingprep.com/stable/balance-sheet-statement-growth-bulk?year=${YEAR}&period=FY`,

  cashflow: `https://financialmodelingprep.com/stable/cash-flow-statement-bulk?year=${YEAR}&period=FY`,
  cashflow_growth: `https://financialmodelingprep.com/stable/cash-flow-statement-growth-bulk?year=${YEAR}&period=FY`,

  ratios: 'https://financialmodelingprep.com/stable/ratios-ttm-bulk',
  metrics: 'https://financialmodelingprep.com/stable/key-metrics-ttm-bulk',
  scores: 'https://financialmodelingprep.com/stable/scores-bulk',
  // quotes: 'https://financialmodelingprep.com/stable/quote-bulk', // REMOVED: 404 and redundant (profile has price)
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
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}apikey=${apiKey}`;
  const filePath = path.join(CACHE_DIR, `${endpointKey}_latest.csv`);

  // console.log(`⬇️ Downloading ${endpointKey} to cache...`);

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${endpointKey}`);
  }

  const buffer = await res.arrayBuffer();
  
  if (buffer.byteLength === 0) {
    throw new Error(`CRITICAL: Empty response body for ${endpointKey}`);
  }

  await fs.promises.writeFile(filePath, Buffer.from(buffer));
  
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
      if (rows.length < 5000) {
        throw new Error(`CRITICAL: Profiles bulk suspicious (rows=${rows.length} < 5000). Aborting.`);
      }
      
      // 🛡️ GUARD: Required Headers (Profiles)
      if (rows.length > 0) {
        const sample = rows[0];
        // Check for essential columns to prevent 'null' sector corruption
        if (!('sector' in sample) && !('Sector' in sample)) {
           throw new Error(`CRITICAL: Profiles CSV missing 'sector' column. Headers: ${Object.keys(sample).join(', ')}`);
        }
        if (!('symbol' in sample) && !('Symbol' in sample) && !('ticker' in sample)) {
           throw new Error(`CRITICAL: Profiles CSV missing 'symbol' column.`);
        }
      }
    }

    // 🛡️ GUARD: General Empty Check
    if (rows.length === 0) {
       // Allow empty for non-critical? No, bulk should have data.
       throw new Error(`Validation Failed: ${endpointKey} parsed 0 rows.`);
    }

    return {
      ok: true,
      data: rows,
      meta: { endpoint: endpointKey, rows: rows.length, cachedFile: filePath }
    };

  } catch (err: any) {
    // Wrap error to identify culprit
    throw new Error(`Cache Validation Failed for ${endpointKey}: ${err.message}`);
  }
}

function indexBySymbol(rows: any[]) {
  const map = new Map<string, any[]>();
  for (const r of rows) {
    const rawSymbol = (r?.symbol || r?.ticker || '').trim().toUpperCase();
    if (!rawSymbol) continue;

    // 1. Index by raw symbol (e.g. "BRK-B")
    if (!map.has(rawSymbol)) map.set(rawSymbol, []);
    map.get(rawSymbol)!.push(r);

    // 2. Index by dot-normalized symbol (e.g. "BRK-B" -> "BRK.B")
    // This handles cases where DB has "BRK.B" but FMP sends "BRK-B"
    if (rawSymbol.includes('-')) {
      const dotSymbol = rawSymbol.replace(/-/g, '.');
      // Only add if not already present (avoid overwriting if FMP somehow sends both)
      if (!map.has(dotSymbol)) {
        map.set(dotSymbol, map.get(rawSymbol)!);
      }
    }
    
    // 3. Index by hyphen-normalized symbol (e.g. "BRK.B" -> "BRK-B")
    // Just in case FMP sends "BRK.B" but DB has "BRK-B"
    if (rawSymbol.includes('.')) {
      const hyphenSymbol = rawSymbol.replace(/\./g, '-');
      if (!map.has(hyphenSymbol)) {
        map.set(hyphenSymbol, map.get(rawSymbol)!);
      }
    }
  }
  return map;
}

export async function fetchAllFmpData(fmpKey: string) {
  console.log('🚀 [FMP-CACHE] Starting Robust Fetch Sequence');

  const endpoints = Object.keys(FMP_CSV_URLS) as (keyof typeof FMP_CSV_URLS)[];
  const filePaths: Record<string, string> = {};

  // ─────────────────────────────────────────
  // STEP 1: DOWNLOAD TO CACHE (Parallel)
  // ─────────────────────────────────────────
  try {
    await Promise.all(endpoints.map(async (key) => {
      filePaths[key] = await downloadToCache(key, fmpKey);
    }));
    console.log('✅ [FMP-CACHE] All files downloaded to cache.');
  } catch (err: any) {
    throw new Error(`⬇️ Download Phase Failed: ${err.message}`);
  }

  // ─────────────────────────────────────────
  // STEP 2 & 3: VALIDATE & PARSE (Sequential or Parallel)
  // ─────────────────────────────────────────
  // We do parallel for speed, validation is inside parseFromCache
  const results: Record<string, BulkFetchResult> = {};

  try {
    await Promise.all(endpoints.map(async (key) => {
      results[key] = await parseFromCache(key, filePaths[key]);
    }));
    console.log('✅ [FMP-CACHE] All files validated and parsed.');
  } catch (err: any) {
    throw new Error(`🛡️ Validation Phase Failed: ${err.message}`);
  }

  const profiles = results['profiles'];
  const income = results['income'];
  const incomeGrowth = results['income_growth'];
  const balance = results['balance'];
  const balanceGrowth = results['balance_growth'];
  const cashflow = results['cashflow'];
  const cashflowGrowth = results['cashflow_growth'];
  const ratios = results['ratios'];
  const metrics = results['metrics'];
  const scores = results['scores'];
  // const quotes = results['quotes']; // Removed

  return {
    meta: {
      income_ok: income.ok,
      balance_ok: balance.ok,
      cashflow_ok: cashflow.ok,
      ratios_ok: ratios.ok,
      metrics_ok: metrics.ok,
      scores_ok: scores.ok,
      // quotes_ok: quotes.ok,
      cached_dir: CACHE_DIR
    },

    profiles: indexBySymbol(profiles.data),
    income: indexBySymbol(income.data),
    income_growth: indexBySymbol(incomeGrowth.data),
    balance: indexBySymbol(balance.data),
    balance_growth: indexBySymbol(balanceGrowth.data),
    cashflow: indexBySymbol(cashflow.data),
    cashflow_growth: indexBySymbol(cashflowGrowth.data),
    ratios: indexBySymbol(ratios.data),
    metrics: indexBySymbol(metrics.data),
    scores: indexBySymbol(scores.data),
    // quotes: indexBySymbol(quotes.data),
  };
}
