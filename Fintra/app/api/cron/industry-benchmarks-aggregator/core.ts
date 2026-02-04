import { supabaseAdmin } from '@/lib/supabase-admin';

type IndustryPerformanceRow = {
  industry: string;
  window_code: string;
  performance_date: string;
  return_percent: number | null;
};

type SectorPerformanceRow = {
  sector: string;
  window_code: string;
  performance_date: string;
  return_percent: number | null;
};

type IndustryClassificationRow = {
	industry_code: string;
	sector: string;
};

type AggregatorResult = {
  ok: boolean;
  as_of_date: string | null;
  industries_processed: number;
  rows_written: number;
  rows_skipped: number;
};

export async function runIndustryBenchmarksAggregator(): Promise<AggregatorResult> {
  const { data: latest, error: latestError } = await supabaseAdmin
    .from('industry_performance')
    .select('performance_date')
    .eq('window_code', '1D')
    .order('performance_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    console.error('[industry-benchmarks] Error resolving as_of_date:', latestError);
    return {
      ok: false,
      as_of_date: null,
      industries_processed: 0,
      rows_written: 0,
      rows_skipped: 0,
    };
  }

  if (!latest?.performance_date) {
    console.warn('[industry-benchmarks] No industry_performance rows for window_code=1D. Skipping.');
    return {
      ok: false,
      as_of_date: null,
      industries_processed: 0,
      rows_written: 0,
      rows_skipped: 0,
    };
  }

  const asOfDate = latest.performance_date as string;

  const { data: perfRows, error: perfError } = await supabaseAdmin
    .from('industry_performance')
    .select('industry, window_code, performance_date, return_percent')
    .eq('performance_date', asOfDate);

  if (perfError) {
    console.error('[industry-benchmarks] Error loading industry_performance rows:', perfError);
    return {
      ok: false,
      as_of_date: asOfDate,
      industries_processed: 0,
      rows_written: 0,
      rows_skipped: 0,
    };
  }

  if (!perfRows || perfRows.length === 0) {
    console.warn('[industry-benchmarks] No industry_performance rows found for as_of_date.');
    return {
      ok: true,
      as_of_date: asOfDate,
      industries_processed: 0,
      rows_written: 0,
      rows_skipped: 0,
    };
  }

  const industrySet = new Set<string>();
  const industryWindows = new Map<string, Map<string, number | null>>();

  for (const row of perfRows as IndustryPerformanceRow[]) {
    const rawIndustry = row.industry;
    const rawWindow = row.window_code;
    if (!rawIndustry || !rawWindow) continue;
    const industry = rawIndustry.trim();
    const windowCode = rawWindow.trim();
    if (!industry || !windowCode) continue;
    industrySet.add(industry);
    let perIndustry = industryWindows.get(industry);
    if (!perIndustry) {
      perIndustry = new Map<string, number | null>();
      industryWindows.set(industry, perIndustry);
    }
    const value = typeof row.return_percent === 'number' ? (Number.isFinite(row.return_percent) ? row.return_percent : null) : row.return_percent ?? null;
    perIndustry.set(windowCode, value);
  }

  const industries = Array.from(industrySet);

  if (!industries.length) {
    console.warn('[industry-benchmarks] No valid industries discovered from industry_performance.');
    return {
      ok: true,
      as_of_date: asOfDate,
      industries_processed: 0,
      rows_written: 0,
      rows_skipped: 0,
    };
  }

  const { data: classifications, error: classError } = await supabaseAdmin
    .from('industry_classification')
		.select('industry_code, sector')
		.in('industry_code', industries);

  if (classError) {
    console.error('[industry-benchmarks] Error loading industry_classification map:', classError);
  }

  const industryToSector = new Map<string, string>();

  if (classifications) {
    for (const row of classifications as IndustryClassificationRow[]) {
			const industry = row.industry_code?.trim();
      const sector = row.sector?.trim();
      if (!industry || !sector) continue;
      if (!industryToSector.has(industry)) {
        industryToSector.set(industry, sector);
      }
    }
  }

  const { data: sectorRows, error: sectorError } = await supabaseAdmin
    .from('sector_performance')
    .select('sector, window_code, performance_date, return_percent')
    .eq('performance_date', asOfDate);

  if (sectorError) {
    console.error('[industry-benchmarks] Error loading sector_performance rows:', sectorError);
    return {
      ok: false,
      as_of_date: asOfDate,
      industries_processed: 0,
      rows_written: 0,
      rows_skipped: 0,
    };
  }

  const sectorWindows = new Map<string, Map<string, number | null>>();

  if (sectorRows) {
    for (const row of sectorRows as SectorPerformanceRow[]) {
      const rawSector = row.sector;
      const rawWindow = row.window_code;
      if (!rawSector || !rawWindow) continue;
      const sector = rawSector.trim();
      const windowCode = rawWindow.trim();
      if (!sector || !windowCode) continue;
      let perSector = sectorWindows.get(sector);
      if (!perSector) {
        perSector = new Map<string, number | null>();
        sectorWindows.set(sector, perSector);
      }
      const value = typeof row.return_percent === 'number' ? (Number.isFinite(row.return_percent) ? row.return_percent : null) : row.return_percent ?? null;
      perSector.set(windowCode, value);
    }
  }

  const upserts: {
    industry: string;
    window_code: string;
    benchmark_type: 'sector' | 'market';
    benchmark_key: string;
    performance_date: string;
    alpha_percent: number | null;
    source: string;
  }[] = [];

  let industriesProcessed = 0;
  let rowsWritten = 0;
  let rowsSkipped = 0;

  for (const industry of industries) {
    const windows = industryWindows.get(industry);
    if (!windows || windows.size === 0) {
      rowsSkipped++;
      continue;
    }

    industriesProcessed++;

    const sector = industryToSector.get(industry) || null;

    for (const [windowCode, industryReturn] of windows.entries()) {
      const sectorReturns = sector ? sectorWindows.get(sector) || null : null;
      const marketReturns = sectorWindows.get('MARKET') || null;

      if (sector) {
        const sectorReturn = sectorReturns ? sectorReturns.get(windowCode) ?? null : null;
        let alpha: number | null = null;
        if (typeof industryReturn === 'number' && Number.isFinite(industryReturn) && typeof sectorReturn === 'number' && Number.isFinite(sectorReturn)) {
          alpha = industryReturn - sectorReturn;
        }
        upserts.push({
          industry,
          window_code: windowCode,
          benchmark_type: 'sector',
          benchmark_key: sector,
          performance_date: asOfDate,
          alpha_percent: alpha,
          source: 'derived_from_performance',
        });
        rowsWritten++;
      } else {
        rowsSkipped++;
      }

      const marketReturn = marketReturns ? marketReturns.get(windowCode) ?? null : null;
      let alphaMarket: number | null = null;
      if (typeof industryReturn === 'number' && Number.isFinite(industryReturn) && typeof marketReturn === 'number' && Number.isFinite(marketReturn)) {
        alphaMarket = industryReturn - marketReturn;
      }
      upserts.push({
        industry,
        window_code: windowCode,
        benchmark_type: 'market',
        benchmark_key: 'MARKET',
        performance_date: asOfDate,
        alpha_percent: alphaMarket,
        source: 'derived_from_performance',
      });
      rowsWritten++;
    }
  }

  if (upserts.length === 0) {
    return {
      ok: true,
      as_of_date: asOfDate,
      industries_processed: industriesProcessed,
      rows_written: 0,
      rows_skipped: rowsSkipped,
    };
  }

  const { error: upsertError } = await supabaseAdmin
    .from('industry_benchmarks')
    .upsert(upserts, {
      onConflict: 'industry,window_code,benchmark_type,performance_date',
    });

  if (upsertError) {
    console.error('[industry-benchmarks] Error upserting industry_benchmarks:', upsertError);
    return {
      ok: false,
      as_of_date: asOfDate,
      industries_processed: industriesProcessed,
      rows_written: 0,
      rows_skipped: rowsSkipped,
    };
  }

  return {
    ok: true,
    as_of_date: asOfDate,
    industries_processed: industriesProcessed,
    rows_written: upserts.length,
    rows_skipped: rowsSkipped,
  };
}
