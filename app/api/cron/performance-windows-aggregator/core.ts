import { supabaseAdmin } from '@/lib/supabase-admin';

type WindowCode = '1Y' | '3Y' | '5Y';

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
const BENCHMARK_TICKER = 'SPY';
const WINDOW_CODES: WindowCode[] = ['1Y', '3Y', '5Y'];

export async function runPerformanceWindowsAggregator() {
  const start = Date.now();
  console.log(`🚀 Starting ${CRON_NAME}...`);

  const { data: latestBenchmarkRow, error: latestError } = await supabaseAdmin
    .from('datos_performance')
    .select('performance_date')
    .eq('ticker', BENCHMARK_TICKER)
    .in('window_code', WINDOW_CODES)
    .order('performance_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error(`[${CRON_NAME}] Error resolving benchmark as_of_date:`, latestError.message);
    return { ok: false, error: latestError.message };
  }

  if (!latestBenchmarkRow || !latestBenchmarkRow.performance_date) {
    console.warn(`[${CRON_NAME}] No benchmark data found for ${BENCHMARK_TICKER}.`);
    return { ok: false, error: 'no_benchmark_data' };
  }

  const asOfDate: string = latestBenchmarkRow.performance_date;

  const { data, error } = await supabaseAdmin
    .from('datos_performance')
    .select('ticker, performance_date, window_code, return_percent, volatility, max_drawdown')
    .eq('performance_date', asOfDate)
    .in('window_code', WINDOW_CODES);

  if (error) {
    console.error(`[${CRON_NAME}] Error fetching performance rows:`, error.message);
    return { ok: false, error: error.message };
  }

  if (!data || data.length === 0) {
    console.warn(`[${CRON_NAME}] No performance data found for as_of_date=${asOfDate}.`);
    return { ok: false, error: 'no_data_for_as_of_date', as_of_date: asOfDate };
  }

  const byTicker = new Map<string, Map<WindowCode, PerformanceRow>>();

  for (const row of data as PerformanceRow[]) {
    if (!WINDOW_CODES.includes(row.window_code)) continue;
    let map = byTicker.get(row.ticker);
    if (!map) {
      map = new Map<WindowCode, PerformanceRow>();
      byTicker.set(row.ticker, map);
    }
    map.set(row.window_code, row);
  }

  const benchmarkMap = byTicker.get(BENCHMARK_TICKER);

  if (!benchmarkMap) {
    console.warn(`[${CRON_NAME}] Benchmark rows missing for ${BENCHMARK_TICKER} on ${asOfDate}.`);
    return { ok: false, error: 'missing_benchmark_rows', as_of_date: asOfDate };
  }

  const assetTickers = Array.from(byTicker.keys()).filter(t => t !== BENCHMARK_TICKER);

  let windowsPrepared = 0;
  let windowsSkippedMissingAsset = 0;
  let windowsSkippedMissingBenchmark = 0;
  let windowsSkippedInvalidReturns = 0;

  const rowsToUpsert: PerformanceWindowRow[] = [];

  for (const ticker of assetTickers) {
    const assetMap = byTicker.get(ticker);
    if (!assetMap) continue;

    for (const w of WINDOW_CODES) {
      const assetRow = assetMap.get(w);
      if (!assetRow) {
        windowsSkippedMissingAsset += 1;
        continue;
      }

      const benchmarkRow = benchmarkMap.get(w);
      if (!benchmarkRow) {
        windowsSkippedMissingBenchmark += 1;
        continue;
      }

      const assetReturn = assetRow.return_percent;
      const benchmarkReturn = benchmarkRow.return_percent;

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
        benchmark_ticker: BENCHMARK_TICKER,
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
        tickers_considered: assetTickers.length,
        windows_prepared: windowsPrepared,
        windows_skipped_missing_asset: windowsSkippedMissingAsset,
        windows_skipped_missing_benchmark: windowsSkippedMissingBenchmark,
        windows_skipped_invalid_returns: windowsSkippedInvalidReturns
      }
    };
  }

  const CHUNK_SIZE = 1000;
  let upserted = 0;

  for (let i = 0; i < rowsToUpsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToUpsert.slice(i, i + CHUNK_SIZE);
    const { error: upsertError } = await supabaseAdmin
      .from('performance_windows')
      .upsert(chunk, {
        onConflict: 'ticker,benchmark_ticker,window_code,as_of_date'
      });

    if (upsertError) {
      console.error(`[${CRON_NAME}] Error upserting chunk:`, upsertError.message);
      return { ok: false, error: upsertError.message };
    }

    upserted += chunk.length;
  }

  const durationMs = Date.now() - start;

  console.log(
    `[${CRON_NAME}] Completed. as_of_date=${asOfDate}, windows=${upserted}, tickers=${assetTickers.length}, duration_ms=${durationMs}`
  );

  return {
    ok: true,
    as_of_date: asOfDate,
    windows_upserted: upserted,
    tickers_considered: assetTickers.length,
    stats: {
      windows_prepared: windowsPrepared,
      windows_skipped_missing_asset: windowsSkippedMissingAsset,
      windows_skipped_missing_benchmark: windowsSkippedMissingBenchmark,
      windows_skipped_invalid_returns: windowsSkippedInvalidReturns
    },
    duration_ms: durationMs
  };
}

