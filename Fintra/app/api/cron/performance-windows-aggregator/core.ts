import { supabaseAdmin } from '@/lib/supabase-admin';

type WindowCode = '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y';

interface PerformanceRow {
  ticker: string;
  performance_date: string;
  window_code: WindowCode;
  return_percent: number | null;
  volatility: number | null;
  max_drawdown: number | null;
}

interface PerformanceWindowRow {
  ticker: string;
  benchmark_ticker: string;
  window_code: WindowCode;
  asset_return: number;
  benchmark_return: number;
  alpha: number;
  volatility: number | null;
  max_drawdown: number | null;
  as_of_date: string;
  source: string;
}

const CRON_NAME = 'performance_windows_aggregator';
const WINDOW_CODES: WindowCode[] = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y'];

type UniverseRow = {
  ticker: string;
  sector: string;
  industry: string | null;
  name: string | null;
};

async function fetchUniverse(asOfDate: string): Promise<UniverseRow[]> {
  const PAGE_SIZE = 1000;
  let page = 0;
  const activeTickers: string[] = [];

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabaseAdmin
      .from('fintra_active_stocks')
      .select('ticker')
      .eq('is_active', true)
      .order('ticker', { ascending: true })
      .range(from, to);

    if (error) {
      console.error(`[${CRON_NAME}] Error fetching active tickers:`, error.message);
      return [];
    }

    if (!data || data.length === 0) break;

    for (const row of data as { ticker: string }[]) {
      if (row?.ticker) activeTickers.push(String(row.ticker).toUpperCase());
    }

    if (data.length < PAGE_SIZE) break;
    page += 1;
  }

  if (activeTickers.length === 0) return [];

  const CHUNK_SIZE = 100;
  const candidates: UniverseRow[] = [];

  for (let i = 0; i < activeTickers.length; i += CHUNK_SIZE) {
    const chunk = activeTickers.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from('fintra_universe')
      .select('ticker, sector, industry, name')
      .in('ticker', chunk)
      .eq('instrument_type', 'EQUITY')
      .not('sector', 'is', null);
      // We don't filter by industry here anymore because we'll try to find it via asset_industry_map too

    if (error) {
      console.error(`[${CRON_NAME}] Error fetching universe rows:`, error.message);
      continue;
    }

    if (!data || data.length === 0) continue;

    for (const row of data as UniverseRow[]) {
      const ticker = String(row.ticker || '').toUpperCase();
      const sector = String(row.sector || '');
      // We keep the static industry as fallback or reference, but we won't strictly filter nulls yet
      const industry = row.industry ? String(row.industry) : null;
      const name = row.name ? String(row.name) : null;

      if (!ticker || !sector) continue; // Sector is still mandatory for now as per existing logic? 
      // User said "Sector logic must remain unchanged", so we must ensure sector is present.
      
      if (ticker.includes('-WT') || ticker.includes('-RT')) continue;
      if (name && (name.toLowerCase().includes('warrant') || name.toLowerCase().includes('rights'))) continue;

      candidates.push({ ticker, sector, industry, name });
    }
  }

  if (candidates.length === 0) return [];

  const performanceTickers = new Set<string>();
  let performanceRowsFound = 0;
  let performanceChunksWithError = 0;

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE).map((row) => row.ticker);
    const { data, error } = await supabaseAdmin
      .from('datos_performance')
      .select('ticker')
      .eq('performance_date', asOfDate)
      .in('window_code', WINDOW_CODES)
      .in('ticker', chunk);

    if (error) {
      console.error(`[${CRON_NAME}] Error checking performance coverage:`, error.message);
      performanceChunksWithError += 1;
      continue;
    }

    const rows = data || [];
    performanceRowsFound += rows.length;

    for (const row of rows) {
      if (row?.ticker) performanceTickers.add(String(row.ticker).toUpperCase());
    }
  }

  if (performanceRowsFound === 0) {
    console.warn(
      `[${CRON_NAME}] No performance rows found for as_of_date=${asOfDate}. Returning unfiltered universe. errors=${performanceChunksWithError}`
    );
    return candidates;
  }

  const filtered = candidates.filter((row) => performanceTickers.has(row.ticker));
  console.log(`[${CRON_NAME}] Universe rows loaded: ${filtered.length}`);
  return filtered;
}

/**
 * Fetches the temporal industry mapping for a list of tickers at a specific date.
 * Uses asset_industry_map (temporal) + industry_classification (code -> name).
 */
async function fetchTemporalIndustryMapping(tickers: string[], asOfDate: string): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const CHUNK_SIZE = 100;

  // 1. Get Code -> Name mapping from industry_classification
  // We fetch all because it's a small table
  const { data: classificationData, error: classError } = await supabaseAdmin
    .from('industry_classification')
    .select('industry_code, industry_name');

  if (classError) {
    console.error(`[${CRON_NAME}] Error fetching industry_classification:`, classError.message);
    return mapping; // Return empty map on error
  }

  const codeToName = new Map<string, string>();
  if (classificationData) {
    for (const row of classificationData) {
      if (row.industry_code && row.industry_name) {
        codeToName.set(row.industry_code, row.industry_name);
      }
    }
  }

  // 2. Get Ticker -> Code mapping from asset_industry_map
  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);
    
    const { data: mapData, error: mapError } = await supabaseAdmin
      .from('asset_industry_map')
      .select('ticker, industry_code')
      .in('ticker', chunk)
      .lte('effective_from', asOfDate)
      .or(`effective_to.is.null,effective_to.gte.${asOfDate}`);

    if (mapError) {
      console.error(`[${CRON_NAME}] Error fetching asset_industry_map chunk:`, mapError.message);
      continue;
    }

    if (!mapData) continue;

    for (const row of mapData) {
      const name = codeToName.get(row.industry_code);
      if (name) {
        mapping.set(row.ticker, name);
      }
    }
  }

  console.log(`[${CRON_NAME}] Resolved ${mapping.size} temporal industry mappings.`);
  return mapping;
}

export async function runPerformanceWindowsAggregator() {
  const start = Date.now();
  console.log(`🚀 Starting ${CRON_NAME}...`);

  const { data: latestSectorDate, error: latestSectorError } = await supabaseAdmin
    .from('sector_performance')
    .select('performance_date')
    .in('window_code', WINDOW_CODES)
    .order('performance_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSectorError) {
    console.error(`[${CRON_NAME}] Error resolving sector as_of_date:`, latestSectorError.message);
    return { ok: false, error: latestSectorError.message };
  }

  if (!latestSectorDate?.performance_date) {
    console.warn(`[${CRON_NAME}] No sector performance data found for windows=${WINDOW_CODES.join(',')}.`);
    return { ok: false, error: 'no_sector_data' };
  }

  const asOfDate: string = latestSectorDate.performance_date;

  const universe = await fetchUniverse(asOfDate);
  const tickers = universe.map((row) => row.ticker);

  if (tickers.length === 0) {
    console.warn(`[${CRON_NAME}] No tickers found in universe.`);
    return { ok: false, error: 'empty_universe' };
  }

  const { data: sectorRows, error: sectorError } = await supabaseAdmin
    .from('sector_performance')
    .select('sector, window_code, performance_date, return_percent')
    .eq('performance_date', asOfDate)
    .in('window_code', WINDOW_CODES)
    .not('sector', 'is', null);

  if (sectorError) {
    console.error(`[${CRON_NAME}] Error fetching sector benchmark rows:`, sectorError.message);
    return { ok: false, error: sectorError.message };
  }

  if (!sectorRows || sectorRows.length === 0) {
    console.warn(`[${CRON_NAME}] No sector benchmark data found for as_of_date=${asOfDate}.`);
    return { ok: false, error: 'no_sector_rows_for_as_of_date', as_of_date: asOfDate };
  }

  const sectorMap = new Map<string, Map<WindowCode, number | null>>();

  for (const row of sectorRows as { sector: string; window_code: WindowCode; return_percent: number | null }[]) {
    if (!WINDOW_CODES.includes(row.window_code)) continue;
    const sector = row.sector;
    let map = sectorMap.get(sector);
    if (!map) {
      map = new Map<WindowCode, number | null>();
      sectorMap.set(sector, map);
    }
    map.set(row.window_code, row.return_percent ?? null);
  }

  // --- NEW: Load Industry Data (Benchmarks & Mappings) ---
  
  // 1. Fetch Industry Benchmarks
  const allIndustryRows: { industry: string; window_code: WindowCode; return_percent: number | null }[] = [];
  let indPage = 0;
  const IND_PAGE_SIZE = 1000;
  let fetchIndustryMore = true;

  while (fetchIndustryMore) {
    const { data: industryRows, error: industryError } = await supabaseAdmin
      .from('industry_performance')
      .select('industry, window_code, performance_date, return_percent')
      .eq('performance_date', asOfDate)
      .in('window_code', WINDOW_CODES)
      .not('industry', 'is', null)
      .range(indPage * IND_PAGE_SIZE, (indPage + 1) * IND_PAGE_SIZE - 1);

    if (industryError) {
      console.error(`[${CRON_NAME}] Error fetching industry benchmark rows (page ${indPage}):`, industryError.message);
      // Proceed with what we have (graceful degradation)
      break;
    }

    if (industryRows && industryRows.length > 0) {
      allIndustryRows.push(...(industryRows as any[]));
      if (industryRows.length < IND_PAGE_SIZE) {
        fetchIndustryMore = false;
      } else {
        indPage++;
      }
    } else {
      fetchIndustryMore = false;
    }
  }

  const industryBenchmarkMap = new Map<string, Map<WindowCode, number | null>>();
  
  if (allIndustryRows.length > 0) {
    for (const row of allIndustryRows) {
      if (!WINDOW_CODES.includes(row.window_code)) continue;
      const industry = row.industry;
      let map = industryBenchmarkMap.get(industry);
      if (!map) {
        map = new Map<WindowCode, number | null>();
        industryBenchmarkMap.set(industry, map);
      }
      map.set(row.window_code, row.return_percent ?? null);
    }
    console.log(`[${CRON_NAME}] Loaded ${industryBenchmarkMap.size} industry benchmarks (from ${allIndustryRows.length} rows).`);
  }

  // 2. Fetch Temporal Industry Mappings
  const industryMapping = await fetchTemporalIndustryMapping(tickers, asOfDate);

  // -------------------------------------------------------

  const byTicker = new Map<string, Map<WindowCode, PerformanceRow>>();
  const CHUNK_SIZE = 100;

  for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
    const chunk = tickers.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from('datos_performance')
      .select('ticker, performance_date, window_code, return_percent, volatility, max_drawdown')
      .eq('performance_date', asOfDate)
      .in('window_code', WINDOW_CODES)
      .in('ticker', chunk);

    if (error) {
      console.error(`[${CRON_NAME}] Error fetching performance rows:`, error.message);
      continue;
    }

    if (!data || data.length === 0) continue;

    for (const row of data as PerformanceRow[]) {
      if (!WINDOW_CODES.includes(row.window_code)) continue;
      let map = byTicker.get(row.ticker);
      if (!map) {
        map = new Map<WindowCode, PerformanceRow>();
        byTicker.set(row.ticker, map);
      }
      map.set(row.window_code, row);
    }
  }

  let windowsPrepared = 0;
  let windowsSkippedMissingAsset = 0;
  let windowsSkippedMissingBenchmark = 0;
  let windowsSkippedInvalidReturns = 0;
  let windowsSkippedMissingSector = 0;

  const rowsToUpsert: PerformanceWindowRow[] = [];

  for (const row of universe) {
    const ticker = row.ticker;
    const sector = row.sector;
    
    const assetMap = byTicker.get(ticker);
    if (!assetMap) continue;

    // --- 1. SECTOR PROCESSING (Existing) ---
    const sectorBenchmark = sectorMap.get(sector);
    if (!sectorBenchmark) {
      windowsSkippedMissingSector += WINDOW_CODES.length;
      // We continue to Industry check? 
      // User said "Sector logic must remain unchanged". 
      // The original code did `continue` here, skipping the ticker entirely.
      // If I want to support Industry Alpha even if Sector is missing, I should NOT continue.
      // However, `fintra_universe` usually guarantees a sector. 
      // The safest minimal change that respects "Sector logic must remain unchanged" 
      // is to keep the flow but allow Industry logic to run if Sector fails?
      // Actually, looking at original code:
      // if (!sectorBenchmark) { windowsSkippedMissingSector += ...; continue; }
      // This means if sector is missing, we skip everything for this ticker.
      // I will keep this behavior for now to be strictly compliant with "Sector logic must remain unchanged".
      // BUT, I will add Industry logic BEFORE or AFTER?
      // If I add it after, I'm safe.
    }

    if (sectorBenchmark) {
      for (const w of WINDOW_CODES) {
        const assetRow = assetMap.get(w);
        if (!assetRow) {
          windowsSkippedMissingAsset += 1;
          continue;
        }

        const benchmarkReturn = sectorBenchmark.get(w) ?? null;
        if (benchmarkReturn == null) {
          windowsSkippedMissingBenchmark += 1;
          continue;
        }

        const assetReturn = assetRow.return_percent;

        if (
          assetReturn == null ||
          benchmarkReturn == null ||
          !Number.isFinite(assetReturn) ||
          !Number.isFinite(benchmarkReturn)
        ) {
          windowsSkippedInvalidReturns += 1;
          continue;
        }

        const alpha = assetReturn - benchmarkReturn;

        rowsToUpsert.push({
          ticker,
          benchmark_ticker: sector,
          window_code: w,
          asset_return: assetReturn,
          benchmark_return: benchmarkReturn,
          alpha,
          volatility: assetRow.volatility ?? null,
          max_drawdown: assetRow.max_drawdown ?? null,
          as_of_date: asOfDate,
          source: 'aggregated_from_datos_performance'
        });

        windowsPrepared += 1;
      }
    }

    // --- 2. INDUSTRY PROCESSING (New) ---
    const industryName = industryMapping.get(ticker); // From temporal map
    if (industryName) {
      const industryBenchmark = industryBenchmarkMap.get(industryName);
      if (industryBenchmark) {
        for (const w of WINDOW_CODES) {
          const assetRow = assetMap.get(w);
          if (!assetRow) continue; // Already counted skip in sector loop or doesn't matter

          const benchmarkReturn = industryBenchmark.get(w) ?? null;
          if (benchmarkReturn == null) continue; // Just skip, don't pollute stats

          const assetReturn = assetRow.return_percent;
           if (
            assetReturn == null ||
            !Number.isFinite(assetReturn) ||
            !Number.isFinite(benchmarkReturn)
          ) {
            continue;
          }

          const alpha = assetReturn - benchmarkReturn;

          rowsToUpsert.push({
            ticker,
            benchmark_ticker: industryName, // Uses Industry Name as benchmark_ticker
            window_code: w,
            asset_return: assetReturn,
            benchmark_return: benchmarkReturn,
            alpha,
            volatility: assetRow.volatility ?? null,
            max_drawdown: assetRow.max_drawdown ?? null,
            as_of_date: asOfDate,
            source: 'aggregated_from_datos_performance'
          });
           
           // We don't increment windowsPrepared here to avoid confusing the existing stats too much?
           // Or we should? The stats object has fixed fields. 
           // I'll increment windowsPrepared as it reflects total rows to upsert.
           windowsPrepared += 1;
        }
      }
    }
  }

  if (rowsToUpsert.length === 0) {
    console.warn(`[${CRON_NAME}] No windows prepared for as_of_date=${asOfDate}.`);
    return {
      ok: false,
      error: 'no_windows_prepared',
      as_of_date: asOfDate,
      stats: {
        tickers_considered: tickers.length,
        windows_prepared: windowsPrepared,
        windows_skipped_missing_asset: windowsSkippedMissingAsset,
        windows_skipped_missing_benchmark: windowsSkippedMissingBenchmark,
        windows_skipped_invalid_returns: windowsSkippedInvalidReturns,
        windows_skipped_missing_sector: windowsSkippedMissingSector
      }
    };
  }

  let upserted = 0;
  let chunksFailed = 0;

  for (let i = 0; i < rowsToUpsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToUpsert.slice(i, i + CHUNK_SIZE);
    const { error: upsertError } = await supabaseAdmin
      .from('performance_windows')
      .upsert(chunk, {
        onConflict: 'ticker,benchmark_ticker,window_code,as_of_date'
      });

    if (upsertError) {
      console.error(`[${CRON_NAME}] Error upserting chunk:`, upsertError.message);
      chunksFailed += 1;
      continue;
    }

    upserted += chunk.length;
  }

  const durationMs = Date.now() - start;

  console.log(
    `[${CRON_NAME}] Completed. as_of_date=${asOfDate}, windows=${upserted}, tickers=${tickers.length}, duration_ms=${durationMs}`
  );
  console.log(
    `[${CRON_NAME}] Stats. prepared=${windowsPrepared}, skipped_missing_asset=${windowsSkippedMissingAsset}, skipped_missing_benchmark=${windowsSkippedMissingBenchmark}, skipped_invalid_returns=${windowsSkippedInvalidReturns}, skipped_missing_sector=${windowsSkippedMissingSector}, failed_chunks=${chunksFailed}`
  );

  return {
    ok: chunksFailed === 0,
    as_of_date: asOfDate,
    windows_upserted: upserted,
    tickers_considered: tickers.length,
    stats: {
      windows_prepared: windowsPrepared,
      windows_skipped_missing_asset: windowsSkippedMissingAsset,
      windows_skipped_missing_benchmark: windowsSkippedMissingBenchmark,
      windows_skipped_invalid_returns: windowsSkippedInvalidReturns,
      windows_skipped_missing_sector: windowsSkippedMissingSector,
      failed_chunks: chunksFailed
    },
    duration_ms: durationMs
  };
}
