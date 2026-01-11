
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Papa from 'papaparse';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getBenchmarksForSector } from '@/lib/engine/benchmarks';
import { resolveValuationFromSector } from '@/lib/engine/resolveValuationFromSector';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

// --- Constants ---
const BASE_URL = 'https://financialmodelingprep.com/stable';
const CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-valuation-bulk');
const SNAPSHOT_CACHE_DIR = path.join(process.cwd(), 'data', 'fmp-snapshot-cache');
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
  // Use native fetch but with Node.js compatible handling (via undici default)
  // Increase robustness against header overflow by limiting what we process if possible, 
  // but mostly just handle errors gracefully.
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

// --- Main Route ---

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: 'Missing FMP_API_KEY' }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  console.log(`[valuation-bulk] Starting run for ${today}`);

  try {
    // 1. Setup Cache
    if (!existsSync(CACHE_DIR)) {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    }

    // 2. Determine EOD Date (Try Today, fallback to Yesterday)
    // We actually need to fetch EOD to see if it has data.
    // Ideally we check FMP market status, but simple fallback is robust.
    let eodDate = today;
    let prices: any[] = [];
    
    // Attempt Today
    const eodPathToday = path.join(CACHE_DIR, `prices_${today}.csv`);
    const eodUrlToday = `${BASE_URL}/eod-bulk?date=${today}&apikey=${API_KEY}`;
    
    // Always try to refresh today's price if not cached or force refresh
    // For bulk cron, we can rely on cache if we assume it runs once successfully.
    // But prices change during day? "eod-bulk" implies End of Day.
    // If we run this during market hours, eod-bulk might be empty or partial?
    // Let's assume we download fresh every time for today.
    
    console.log(`[valuation-bulk] Downloading prices for ${today}...`);
    await downloadFile(eodUrlToday, eodPathToday);
    prices = await getCsvData(eodPathToday);

    if (prices.length < 1000) {
      console.warn(`[valuation-bulk] Low data count for ${today} (${prices.length}). Falling back to yesterday.`);
      // Fallback to yesterday
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      eodDate = yesterday;
      const eodPathYesterday = path.join(CACHE_DIR, `prices_${yesterday}.csv`);
      const eodUrlYesterday = `${BASE_URL}/eod-bulk?date=${yesterday}&apikey=${API_KEY}`;
      
      if (!existsSync(eodPathYesterday)) {
          await downloadFile(eodUrlYesterday, eodPathYesterday);
      }
      prices = await getCsvData(eodPathYesterday);
    }
    
    console.log(`[valuation-bulk] Using prices from ${eodDate} (Count: ${prices.length})`);

    // --- NEW: Fetch Snapshot Prices (Canonical Source) ---
    console.log(`[valuation-bulk] Fetching canonical prices from fintra_snapshots...`);
    // We fetch snapshots from the last 7 days to ensure coverage.
    // We want the LATEST snapshot for each ticker that has a valid price.
    const lookbackDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    
    // We use a raw query or a smart select. 
    // Since we need "distinct on ticker", and supabase-js select support for that can be tricky with JSONB,
    // we will fetch recent snapshots and dedup in memory.
    // We only need ticker and the price field from JSON.
    const { data: snapshotData, error: snapshotError } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('ticker, profile_structural, snapshot_date')
        .gte('snapshot_date', lookbackDate)
        .not('profile_structural->metrics->price', 'is', null)
        .order('snapshot_date', { ascending: false });

    if (snapshotError) {
        console.error("Error fetching snapshots:", snapshotError);
        throw snapshotError;
    }

    const snapshotPriceMap = new Map<string, { price: number, marketCap: number | null, date: string }>();
    if (snapshotData) {
        for (const row of snapshotData) {
            if (!snapshotPriceMap.has(row.ticker)) {
                const p = row.profile_structural as any;
                const priceVal = p?.metrics?.price;
                const marketCapVal = p?.metrics?.marketCap; // Canonical source
                
                const safePrice = getSafeNumber(priceVal);
                const safeMarketCap = getSafeNumber(marketCapVal);
                
                if (safePrice !== null && Number.isFinite(safePrice)) {
                    snapshotPriceMap.set(row.ticker, { 
                        price: safePrice, 
                        marketCap: safeMarketCap,
                        date: row.snapshot_date 
                    });
                }
            }
        }
    }
    console.log(`[valuation-bulk] Loaded ${snapshotPriceMap.size} canonical prices from snapshots.`);

    // 3. Download other bulk files
    const files = [
      { key: 'profile', url: `${BASE_URL}/profile-bulk?apikey=${API_KEY}`, path: path.join(SNAPSHOT_CACHE_DIR, 'profiles_latest.csv') },
      { key: 'metrics', url: `${BASE_URL}/key-metrics-ttm-bulk?apikey=${API_KEY}`, path: path.join(SNAPSHOT_CACHE_DIR, 'metrics_latest.csv') },
      { key: 'ratios', url: `${BASE_URL}/ratios-ttm-bulk?apikey=${API_KEY}`, path: path.join(SNAPSHOT_CACHE_DIR, 'ratios_latest.csv') }
    ];

    for (const f of files) {
      if (existsSync(f.path)) {
         console.log(`[valuation-bulk] Using existing cached file for ${f.key}: ${f.path}`);
         // We prefer the user-provided snapshot cache and do not refresh it automatically here.
      } else {
        console.log(`[valuation-bulk] Downloading ${f.key}...`);
        try {
            await downloadFile(f.url, f.path);
        } catch (err: any) {
             console.error(`[valuation-bulk] Error downloading ${f.key}:`, err.message);
             // Critical failure if profile/metrics/ratios missing? 
             // Maybe we can proceed with partial data if files exist from before?
             // But here we are in the else block (file didn't exist).
             // Retry once?
             console.log(`[valuation-bulk] Retrying download for ${f.key}...`);
             await new Promise(r => setTimeout(r, 2000));
             await downloadFile(f.url, f.path);
        }
      }
    }

    // 4. Load Maps
    console.log(`[valuation-bulk] Parsing CSVs...`);
    const profileData = await getCsvData(files[0].path);
    const metricsData = await getCsvData(files[1].path);
    const ratiosData = await getCsvData(files[2].path);

    const profileMap = new Map(profileData.map(r => [r.symbol, r]));
    const metricsMap = new Map(metricsData.map(r => [r.symbol, r]));
    const ratiosMap = new Map(ratiosData.map(r => [r.symbol, r]));
    const priceMap = new Map(prices.map(r => [r.symbol, r]));

    // 5. Fetch Latest FY from DB (Batched)
    console.log(`[valuation-bulk] Fetching latest FY periods from DB (Batched)...`);
    
    const allTickers = profileData.map(p => p.symbol).filter(t => t);
    // Use a Set to deduplicate tickers just in case
    const uniqueTickers = Array.from(new Set(allTickers));
    
    const BATCH_SIZE = 1500;
    const fyMap = new Map<string, string>();

    for (let i = 0; i < uniqueTickers.length; i += BATCH_SIZE) {
        const batch = uniqueTickers.slice(i, i + BATCH_SIZE);
        // Simple sanitization for SQL literal list
        const { data: batchData, error: batchError } = await supabaseAdmin
            .from('datos_financieros')
            .select('ticker, period_label')
            .eq('period_type', 'FY')
            .in('ticker', batch)
            .order('ticker', { ascending: true })
            .order('period_end_date', { ascending: false });

        if (batchError) {
             console.error(`[valuation-bulk] Error fetching batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batchError);
             throw batchError;
        }

        if (batchData) {
            for (const r of batchData) {
                // Since we ordered by date DESC, the first one we see is the latest
                if (!fyMap.has(r.ticker)) {
                    fyMap.set(r.ticker, r.period_label);
                }
            }
        }
        console.log(`[valuation-bulk] Batch ${Math.floor(i/BATCH_SIZE) + 1} processed. Total found so far: ${fyMap.size}`);
    }

    console.log(`[valuation-bulk] Loaded ${fyMap.size} FY periods.`);

    // 5b. Pre-fetch Sector Benchmarks
    // We fetch benchmarks once per sector to avoid async calls in the loop
    console.log(`[valuation-bulk] Pre-fetching sector benchmarks...`);
    const uniqueSectors = Array.from(new Set(profileData.map(p => p.sector).filter(s => s)));
    const sectorBenchmarksMap = new Map<string, any>();
    
    // We use "today" so it finds the latest available benchmarks <= today
    for (const sector of uniqueSectors) {
        if (!sector) continue;
        // getBenchmarksForSector handles caching internally, but we do it here to have a synchronous map
        const benches = await getBenchmarksForSector(sector, today, true);
        if (benches) {
            sectorBenchmarksMap.set(sector, benches);
        }
    }
    console.log(`[valuation-bulk] Loaded benchmarks for ${sectorBenchmarksMap.size} sectors.`);

    // 6. Build Valuation Rows
    console.log(`[valuation-bulk] Building valuation rows...`);
    const allRows: ValuationRow[] = [];
    const currentYear = new Date().getFullYear();
    const daysSinceEod = Math.floor((new Date(today).getTime() - new Date(eodDate).getTime()) / (1000 * 3600 * 24));

    // Fix: Valuation Date must match the price date (eodDate), not the run date (today).
    // This ensures temporal consistency.
    // However, with Snapshot Price resolution, we should use the snapshot date or keep consistent with bulk run?
    // User requirement: "Supabase snapshots are the canonical source for market price."
    // We will use the snapshot date for freshness calculation if available, 
    // but the valuation row itself usually represents the "run" date or the "price" date.
    // Let's stick to the computed valuationDate (eodDate) for the row's primary date to align with the batch,
    // but we could arguable use the snapshot's date. 
    // Given the instruction "Valuation rows are generated only when a valid snapshot price exists",
    // let's default to the snapshot's date for the valuation_date to be precise?
    // User instruction says: "Prefer the most recent snapshot...".
    // If I use a snapshot from yesterday, the valuation is for yesterday.
    // But this is a bulk job running for "Today" (or eodDate).
    // If we mix dates, we might have multiple rows for different dates in one batch.
    // Let's use the `snapshotPrice.date` as the `valuation_date` for that row. 
    // This guarantees that `price` matches `valuation_date`.
    
    let skippedCount = 0;
    let missingPriceCount = 0;

    for (const profile of profileData) {
        const ticker = profile.symbol;
        if (!ticker) continue;

        // Retrieve CSV data for metrics/ratios
        const metrics = metricsMap.get(ticker);
        const ratios = ratiosMap.get(ticker);
        const fyLabel = fyMap.get(ticker);

        // Resolve Price from Snapshot (Canonical)
        const snapshotInfo = snapshotPriceMap.get(ticker);
        
        // Fallback Logic:
        // "If a snapshot exists for the ticker/date but metrics.price is missing... Skip valuation row generation"
        // "Do NOT attempt to resolve price from CSVs or other sources."
        if (!snapshotInfo) {
            missingPriceCount++;
            continue;
        }

        const price = snapshotInfo.price;
        // Override valuationDate with the actual date of the price source
        const rowValuationDate = snapshotInfo.date; 

        // CRITICAL: Prevent invalid valuation rows.
        // A valuation without a valid price is economically meaningless and breaks the model.
        if (price === null || price === undefined || !Number.isFinite(price)) {
            skippedCount++;
            continue;
        }
        
        // Market Cap priority: Canonical Snapshot > null
        // We do NOT fallback to CSVs or legacy helpers.
        const marketCap = snapshotInfo.marketCap;
        
        // Base Metrics
        const pe = getSafeNumber(metrics?.peRatioTTM);
        const evEbitda = getSafeNumber(metrics?.evToEBITDATTM);
        
        const fcfYield = getSafeNumber(metrics?.freeCashFlowYieldTTM);
        const pFcf = (fcfYield && fcfYield > 0) ? (1 / fcfYield) : null;
        
        const pBook = getSafeNumber(metrics?.priceToBookRatioTTM);
        const pSales = getSafeNumber(metrics?.priceToSalesRatioTTM);
        const divYield = getSafeNumber(metrics?.dividendYieldTTM);
        const peg = getSafeNumber(ratios?.pegRatioTTM);
        const ev = getSafeNumber(metrics?.enterpriseValueTTM);
        const sector = profile.sector || null;

        // Try to get EV/Sales
        let evSales = null;
        if (metrics && 'evToSalesTTM' in metrics) {
             evSales = getSafeNumber(metrics.evToSalesTTM);
        }

        // Compute Valuation Status (Sector Benchmarks)
        let valuationStatus = 'Pending';
        if (sector && sectorBenchmarksMap.has(sector)) {
            const benchmarks = sectorBenchmarksMap.get(sector);
            const valResult = resolveValuationFromSector(
                { 
                    sector, 
                    pe_ratio: pe, 
                    ev_ebitda: evEbitda, 
                    price_to_fcf: pFcf 
                },
                benchmarks
            );
            valuationStatus = valResult.valuation_status;
        }

        // Common Fields
        const baseRow = {
            ticker,
            valuation_date: rowValuationDate,
            price,
            market_cap: marketCap,
            enterprise_value: ev,
            pe_ratio: pe,
            pe_forward: null, // Not available in bulk
            peg_ratio: peg,
            ev_ebitda: evEbitda,
            ev_sales: evSales,
            price_to_book: pBook,
            price_to_sales: pSales,
            price_to_fcf: pFcf,
            dividend_yield: divYield,
            sector,
            pe_percentile: null,
            ev_ebitda_percentile: null,
            p_fcf_percentile: null,
            composite_percentile: null,
            valuation_status: valuationStatus,
            source: 'fmp_bulk',
            data_freshness: daysSinceEod
        };

        // 1. TTM Row
        allRows.push({
            ...baseRow,
            denominator_type: 'TTM',
            denominator_period: `${currentYear}_TTM`
        });

        // 2. FY Row (if exists)
        if (fyLabel) {
            allRows.push({
                ...baseRow,
                denominator_type: 'FY',
                denominator_period: `${fyLabel}_FY`
            });
        }
    }

    // 7. Compute Percentiles (Sector-based)
    console.log(`[valuation-bulk] Building rows complete. Skipped (invalid price): ${skippedCount}. Missing Snapshot: ${missingPriceCount}. Total Rows: ${allRows.length}`);
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
        if (rows.length < 10) continue; // Minimum peers constraint

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

    // 8. Upsert in Batches
    console.log(`[valuation-bulk] Upserting ${allRows.length} rows...`);
    const UPSERT_BATCH_SIZE = 500;
    for (let i = 0; i < allRows.length; i += UPSERT_BATCH_SIZE) {
        const batch = allRows.slice(i, i + UPSERT_BATCH_SIZE);
        const { error } = await supabaseAdmin.from('datos_valuacion').upsert(batch, {
            onConflict: 'ticker,valuation_date,denominator_type,denominator_period'
        });
        
        if (error) {
            console.error(`[valuation-bulk] Upsert error batch ${i}:`, error);
        }
    }

    return NextResponse.json({ 
        success: true, 
        processed: allRows.length, 
        date: today,
        eod_date: eodDate 
    });

  } catch (err: any) {
    console.error(`[valuation-bulk] Fatal error:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
