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

  const CHUNK_SIZE = 1000;
  const candidates: UniverseRow[] = [];

  for (let i = 0; i < activeTickers.length; i += CHUNK_SIZE) {
    const chunk = activeTickers.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabaseAdmin
      .from('fintra_universe')
      .select('ticker, sector, industry, name')
      .in('ticker', chunk)
      .eq('instrument_type', 'EQUITY')
      .not('sector', 'is', null)
      .not('industry', 'is', null);

    if (error) {
      console.error(`[${CRON_NAME}] Error fetching universe rows:`, error.message);
      continue;
    }

    if (!data || data.length === 0) continue;

    for (const row of data as UniverseRow[]) {
      const ticker = String(row.ticker || '').toUpperCase();
      const sector = String(row.sector || '');
      const industry = row.industry ? String(row.industry) : null;
      const name = row.name ? String(row.name) : null;

      if (!ticker || !sector || !industry) continue;
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

  const byTicker = new Map<string, Map<WindowCode, PerformanceRow>>();
  const CHUNK_SIZE = 1000;

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
    const sectorBenchmark = sectorMap.get(sector);
    if (!sectorBenchmark) {
      windowsSkippedMissingSector += WINDOW_CODES.length;
      continue;
    }

    const assetMap = byTicker.get(ticker);
    if (!assetMap) continue;

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
