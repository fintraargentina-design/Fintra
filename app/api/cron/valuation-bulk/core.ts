import { supabaseAdmin } from '@/lib/supabase-admin';
import Papa from 'papaparse';
import fs from 'fs/promises';
import path from 'path';

// --- Constants ---
const CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-valuation-bulk');
const API_KEY = process.env.FMP_API_KEY;

// --- Interfaces ---
interface ValuationRow {
  ticker: string;
  valuation_date: string;
  denominator_type: 'TTM' | 'FY';
  denominator_period: string;
  price: number | null;
  market_cap: number | null;
  enterprise_value: number | null;
  pe_ratio: number | null;
  pe_forward: number | null;
  peg_ratio: number | null;
  ev_ebitda: number | null;
  ev_sales: number | null;
  price_to_book: number | null;
  price_to_sales: number | null;
  price_to_fcf: number | null;
  dividend_yield: number | null;
  sector: string | null;
  pe_percentile: number | null;
  ev_ebitda_percentile: number | null;
  p_fcf_percentile: number | null;
  composite_percentile: number | null;
  valuation_status: string | null;
  source: string;
  data_freshness: number;
}

// --- Helper Functions ---

async function downloadFile(url: string, filePath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  
  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

async function getCsvData(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = Papa.parse(content, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return parsed.data as any[];
}

function getSafeNumber(val: any): number | null {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function calculatePercentile(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  // Binary search or simple findIndex (sortedValues is sorted asc)
  let rank = 0;
  for (let i = 0; i < sortedValues.length; i++) {
    if (value >= sortedValues[i]) {
      rank = i + 1;
    } else {
      break;
    }
  }
  return Math.round((rank / sortedValues.length) * 100);
}

// --- Core Logic ---

export interface ValuationRunOptions {
  targetTicker?: string;
  debugMode?: boolean; // Must be true to allow single-ticker API calls and fake percentiles
  limit?: number;
}

export async function runValuationBulk(options: ValuationRunOptions = {}) {
  const { targetTicker, debugMode, limit } = options;

  if (!API_KEY) {
    throw new Error('Missing FMP_API_KEY');
  }

  const today = new Date().toISOString().slice(0, 10);
  console.log(`[valuation-bulk] Starting run for ${today}`);

  try {
    let ratiosData: any[] = [];
    let metricsData: any[] = [];
    let profilesData: any[] = [];

    // --- DEBUG PATH (Single Ticker API) ---
    // Only allowed if targetTicker IS SET and debugMode IS TRUE
    if (targetTicker && debugMode) {
       console.log(`[valuation-bulk] 🧪 DEBUG MODE: Fetching single ticker API data for ${targetTicker}`);
       
       // Helper to fetch and normalize single ticker data to array
       const fetchOne = async (endpoint: string) => {
         const res = await fetch(`https://financialmodelingprep.com/api/v3/${endpoint}/${targetTicker}?apikey=${API_KEY}`);
         if (!res.ok) throw new Error(`Failed to fetch ${endpoint}: ${res.statusText}`);
         return await res.json();
       };

       const [ratios, metrics, profiles] = await Promise.all([
         fetchOne('ratios-ttm'),
         fetchOne('key-metrics-ttm'),
         fetchOne('profile')
       ]);

       ratiosData = ratios;
       metricsData = metrics;
       profilesData = profiles;

    } else {
        // --- PRODUCTION PATH (Bulk CSV) ---
        // Runs for ALL tickers OR filters for targetTicker if provided (without using API)
        await fs.mkdir(CACHE_DIR, { recursive: true });

        // 1. Download Files
        const files = [
          { name: 'ratios-ttm.csv', url: `https://financialmodelingprep.com/stable/ratios-ttm-bulk?apikey=${API_KEY}` },
          { name: 'metrics-ttm.csv', url: `https://financialmodelingprep.com/stable/key-metrics-ttm-bulk?apikey=${API_KEY}` },
          // Note: profile-bulk usually requires pagination or different handling if huge, 
          // but if it worked before we keep it. If it fails with Bad Request, it might need part=0.
          // Trying part=0 for safety if this is the issue.
          { name: 'profile.csv', url: `https://financialmodelingprep.com/stable/profile-bulk?part=0&apikey=${API_KEY}` }
        ];

        console.log('[valuation-bulk] Downloading bulk files...');
        await Promise.all(files.map(f => {
          const p = path.join(CACHE_DIR, f.name);
          return downloadFile(f.url, p);
        }));
        
        // 2. Read and Parse
        console.log('[valuation-bulk] Parsing files...');
        ratiosData = await getCsvData(path.join(CACHE_DIR, 'ratios-ttm.csv'));
        metricsData = await getCsvData(path.join(CACHE_DIR, 'metrics-ttm.csv'));
        profilesData = await getCsvData(path.join(CACHE_DIR, 'profile.csv'));
    }

    console.log(`[valuation-bulk] Data loaded. Ratios: ${ratiosData.length}, Metrics: ${metricsData.length}, Profiles: ${profilesData.length}`);

    // 2. Filter Rows by Ticker Universe (Active Only)
    console.log('[valuation-bulk] Fetching active universe...');
    const activeSet = new Set<string>();
    const BATCH_SIZE = 1000;
    let page = 0;

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('fintra_universe')
            .select('ticker')
            .eq('is_active', true)
            .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

        if (error) throw new Error(`Error fetching universe: ${error.message}`);
        if (!data || data.length === 0) break;

        data.forEach(d => {
            if (d.ticker) activeSet.add(d.ticker);
        });

        if (data.length < BATCH_SIZE) break;
        page++;
    }
    console.log(`[valuation-bulk] Active Universe Size: ${activeSet.size}`);

    if (targetTicker && activeSet.has(targetTicker)) {
       // Keep only target
       profilesData = profilesData.filter(p => p.symbol === targetTicker);
    } else if (limit && limit > 0) {
        console.log(`🧪 BENCHMARK MODE: Limiting valuation to first ${limit} tickers`);
        // We need to limit based on the rows we have, but ensuring they are active
        // Simplest way: take first N active tickers found in the CSV data
        const limitedTickers = new Set<string>();
        let count = 0;
        
        // This is a heuristic: we iterate profiles (which drives the process)
        for(const p of profilesData) {
            if (activeSet.has(p.symbol)) {
                limitedTickers.add(p.symbol);
                count++;
                if (count >= limit) break;
            }
        }
        activeSet.clear(); // Replace full active set with limited set
        for (const t of limitedTickers) activeSet.add(t);
    }

    // Filter all datasets
    profilesData = profilesData.filter(p => activeSet.has(p.symbol));
    ratiosData = ratiosData.filter(r => activeSet.has(r.symbol));
    metricsData = metricsData.filter(m => activeSet.has(m.symbol));

     let symbolKey = 'symbol';
     if (targetTicker && ratiosData.length > 0) {
         symbolKey = Object.keys(ratiosData[0]).find(k => k.trim().toLowerCase() === 'symbol') || 'symbol';
         console.log('[DEBUG] Detected Symbol Key:', symbolKey);
         console.log('[DEBUG] Ratio Symbol Value:', ratiosData[0][symbolKey]);
      }

     // 3. Build Maps
    const metricsMap = new Map<string, any>();
    metricsData.forEach(r => {
        const key = Object.keys(r).find(k => k.trim().toLowerCase() === 'symbol') || 'symbol';
        if (r[key]) metricsMap.set(r[key], r);
    });

    const profileMap = new Map<string, any>();
    profilesData.forEach(r => {
        const key = Object.keys(r).find(k => k.trim().toLowerCase() === 'symbol') || 'symbol';
        if (r[key]) profileMap.set(r[key], r);
    });

    // 4. Process Ratios (Base)
    console.log('[valuation-bulk] Processing rows...');
    const allRows: ValuationRow[] = [];
    let skippedCount = 0;
      for (const ratioRow of ratiosData) {
          let ticker = ratioRow[symbolKey];
          // FALLBACK for debug mode if symbol extraction fails but we know the ticker
          if (!ticker && targetTicker) {
              ticker = targetTicker;
          }

          if (!ticker) continue;

        // FILTER: If targetTicker is set, skip others
        if (targetTicker && ticker !== targetTicker) continue;

        const metricsRow = metricsMap.get(ticker);
        const profileRow = profileMap.get(ticker);

        if (!profileRow || !profileRow.sector) {
            // Profile is needed for Sector and Price
            // DB requires sector (NOT NULL)
            continue; 
        }

        const price = getSafeNumber(profileRow.price);
        if (!price || price <= 0) {
            skippedCount++;
            continue;
        }

        // Mapping
        const row: ValuationRow = {
            ticker,
            valuation_date: today,
            denominator_type: 'TTM',
            denominator_period: 'TTM', // FMP bulk doesn't specify period, assume current TTM

            price: price,
            market_cap: getSafeNumber(profileRow.mktCap || profileRow.marketCap),
            enterprise_value: getSafeNumber(metricsRow?.enterpriseValue),

            pe_ratio: getSafeNumber(ratioRow.priceEarningsRatioTTM),
            pe_forward: null, // Not in these bulks usually
            peg_ratio: getSafeNumber(ratioRow.priceEarningsToGrowthRatioTTM),
            
            ev_ebitda: getSafeNumber(metricsRow?.enterpriseValueOverEBITDATTM),
            ev_sales: getSafeNumber(metricsRow?.evToSalesTTM), // or enterpriseValueOverRevenueTTM
            
            price_to_book: getSafeNumber(ratioRow.priceToBookRatioTTM),
            price_to_sales: getSafeNumber(ratioRow.priceToSalesRatioTTM),
            price_to_fcf: getSafeNumber(ratioRow.priceToFreeCashFlowsRatioTTM),
            
            dividend_yield: getSafeNumber(ratioRow.dividendYielTTM) || getSafeNumber(ratioRow.dividendYieldTTM),
            
            sector: profileRow.sector,
            
            // Percentiles (computed later)
            pe_percentile: null,
            ev_ebitda_percentile: null,
            p_fcf_percentile: null,
            composite_percentile: null,
            valuation_status: null, // "Pending" until computed
            
            source: 'fmp_bulk_ttm',
            data_freshness: 0
        };
        
        allRows.push(row);
    }

    console.log(`[valuation-bulk] Building rows complete. Skipped (invalid price): ${skippedCount}. Total Rows: ${allRows.length}`);
    console.log(`[valuation-bulk] Computing percentiles...`);
    const rowsBySector = new Map<string, ValuationRow[]>();
    
    // Group
    for (const row of allRows) {
        if (!row.sector) continue;
        if (!rowsBySector.has(row.sector)) rowsBySector.set(row.sector, []);
        rowsBySector.get(row.sector)!.push(row);
    }

    // Calculate
    for (const [sector, rows] of rowsBySector.entries()) {
        // If we are debugging a single ticker, we might not have enough peers for percentiles
        
        if (targetTicker && rows.length < 2) {
             // Trivial case logic is ONLY allowed in DEBUG mode
             if (debugMode) {
                console.log('[valuation-bulk] 🧪 DEBUG MODE: Applying fake 50% percentiles for single ticker.');
                for (const row of rows) {
                    row.pe_percentile = 50;
                    row.ev_ebitda_percentile = 50;
                    row.p_fcf_percentile = 50;
                    row.composite_percentile = 50;
                    // Try null to bypass constraint, or 'Fair' if null fails.
                    // 'pending' failed with check constraint.
                    row.valuation_status = null;
                }
             } else {
                 console.log('[valuation-bulk] Not enough peers for percentiles. Leaving null.');
             }
             continue;
        }

        // Extract valid values for each metric
        const peValues = rows.map(r => r.pe_ratio).filter(v => v !== null && v > 0).sort((a, b) => a! - b!) as number[];
        const evEbitdaValues = rows.map(r => r.ev_ebitda).filter(v => v !== null && v > 0).sort((a, b) => a! - b!) as number[];
        const pFcfValues = rows.map(r => r.price_to_fcf).filter(v => v !== null && v > 0).sort((a, b) => a! - b!) as number[];

        for (const row of rows) {
            if (row.pe_ratio && row.pe_ratio > 0) {
                row.pe_percentile = calculatePercentile(row.pe_ratio, peValues);
            }
            if (row.ev_ebitda && row.ev_ebitda > 0) {
                row.ev_ebitda_percentile = calculatePercentile(row.ev_ebitda, evEbitdaValues);
            }
            if (row.price_to_fcf && row.price_to_fcf > 0) {
                row.p_fcf_percentile = calculatePercentile(row.price_to_fcf, pFcfValues);
            }

            // Composite
            const percentiles = [row.pe_percentile, row.ev_ebitda_percentile, row.p_fcf_percentile].filter(v => v !== null) as number[];
            if (percentiles.length > 0) {
                const sum = percentiles.reduce((a, b) => a + b, 0);
                row.composite_percentile = Math.round(sum / percentiles.length);
            }
        }
    }

    // 5. Upsert in Batches
    // If targetTicker is set, we only upsert that one.
    // (We already filtered allRows earlier).
    
    console.log(`[valuation-bulk] Upserting ${allRows.length} rows...`);
    const UPSERT_BATCH_SIZE = 500;
    let upserted = 0;

    for (let i = 0; i < allRows.length; i += UPSERT_BATCH_SIZE) {
        const batch = allRows.slice(i, i + UPSERT_BATCH_SIZE);
        const { error } = await supabaseAdmin
            .from('datos_valuacion')
            .upsert(batch, { onConflict: 'ticker,valuation_date,denominator_type,denominator_period' });
        
        if (error) {
            console.error('[valuation-bulk] Upsert error:', error);
        } else {
            upserted += batch.length;
        }
    }

    console.log(`[valuation-bulk] Done. Upserted: ${upserted}`);
    return { success: true, upserted };

  } catch (err) {
    console.error('[valuation-bulk] Critical error:', err);
    throw err;
  }
}
