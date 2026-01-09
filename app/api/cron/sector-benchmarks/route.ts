import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { buildSectorBenchmark } from '@/lib/engine/buildSectorBenchmark';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import { BENCHMARK_METRICS } from '@/lib/engine/benchmarks';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_NAME = 'sector_stats_builder';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`🚀 Starting ${CRON_NAME} for ${today}`);

  try {
    // ─────────────────────────────────────────
    // 1. CHECK CURSOR (Idempotency + Data Integrity)
    // ─────────────────────────────────────────
    const { data: state } = await supabaseAdmin
      .from('cron_state')
      .select('last_run_date')
      .eq('name', CRON_NAME)
      .single();

    // Verify if we actually have data for today
    const { count } = await supabaseAdmin
      .from('sector_benchmarks')
      .select('*', { count: 'exact', head: true })
      .eq('snapshot_date', today);

    const alreadyRun = state?.last_run_date === today;
    const hasData = (count ?? 0) > 0;

    if (alreadyRun && hasData) {
      console.log('✅ Already run today & Data exists. Skipping.');
      return NextResponse.json({ skipped: true, date: today });
    }

    if (alreadyRun && !hasData) {
      console.warn(`⚠️ Cron marked as done but NO DATA found (count=${count}). Forcing re-run.`);
    }

    // ─────────────────────────────────────────
    // 2. FETCH SNAPSHOTS (Base Universe & Sector Map)
    // ─────────────────────────────────────────
    // We fetch ALL snapshots for today to build the universe
    const { data: snapshots, error: snapError } = await supabaseAdmin
      .from('fintra_snapshots')
      .select(`
        ticker,
        sector,
        valuation,
        fundamentals_growth,
        profile_structural
      `)
      .eq('snapshot_date', today);

    if (snapError) throw snapError;
    if (!snapshots?.length) {
      return NextResponse.json({ error: 'No snapshots found for today' }, { status: 500 });
    }

    // FILTER: Only Active Stocks (Equities)
    const validTickers = new Set(await getActiveStockTickers(supabaseAdmin));
    const validSnapshots = snapshots.filter(s => validTickers.has(s.ticker));

    console.log(`📉 Snapshots filtered: ${snapshots.length} -> ${validSnapshots.length} (Active Equities only)`);

    // Map Ticker -> Sector/Industry
    const tickerSectorMap = new Map<string, string>();
    const tickerIndustryMap = new Map<string, string>();

    // Buckets for aggregation
    // Structure: { [SectorName]: { [MetricName]: number[] } }
    const sectorBuckets: Record<string, Record<string, number[]>> = {};
    const industryBuckets: Record<string, Record<string, number[]>> = {};

    // Helper to push value to buckets
    const pushToBucket = (
      sector: string | null,
      industry: string | null,
      metric: string,
      value: number | null | undefined
    ) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return;

      if (sector) {
        if (!sectorBuckets[sector]) sectorBuckets[sector] = {};
        if (!sectorBuckets[sector][metric]) sectorBuckets[sector][metric] = [];
        sectorBuckets[sector][metric].push(value);
      }

      if (industry) {
        if (!industryBuckets[industry]) industryBuckets[industry] = {};
        if (!industryBuckets[industry][metric]) industryBuckets[industry][metric] = [];
        industryBuckets[industry][metric].push(value);
      }
    };

    const activeTickers: string[] = [];

    for (const snap of validSnapshots) {
      const ticker = snap.ticker;
      // Fallback sector logic
      const sector = snap.sector || snap.profile_structural?.classification?.sector;
      const industry = snap.profile_structural?.classification?.industry;

      if (!sector) continue; 

      tickerSectorMap.set(ticker, sector);
      if (industry) tickerIndustryMap.set(ticker, industry);
      activeTickers.push(ticker);

      // 2a. Extract Snapshot Metrics (Valuation & Growth)
      const val = snap.valuation || {};
      const growth = snap.fundamentals_growth || {};

      pushToBucket(sector, industry, 'pe_ratio', val.pe_ratio);
      pushToBucket(sector, industry, 'ev_ebitda', val.ev_ebitda);
      pushToBucket(sector, industry, 'price_to_fcf', val.price_to_fcf);

      pushToBucket(sector, industry, 'revenue_cagr', growth.revenue_cagr);
      pushToBucket(sector, industry, 'earnings_cagr', growth.earnings_cagr);
      pushToBucket(sector, industry, 'fcf_cagr', growth.fcf_cagr);
    }

    // ─────────────────────────────────────────
    // 3. FETCH FINANCIALS (Profitability/Solvency)
    // ─────────────────────────────────────────
    // Chunking to handle large number of tickers
    const CHUNK_SIZE = 500;
    const tickerChunks = [];
    for (let i = 0; i < activeTickers.length; i += CHUNK_SIZE) {
        tickerChunks.push(activeTickers.slice(i, i + CHUNK_SIZE));
    }

    console.log(`📊 Fetching financials for ${activeTickers.length} tickers in ${tickerChunks.length} chunks...`);

    let financialsCount = 0;

    for (const chunk of tickerChunks) {
        // AS-OF Resolution: period_end_date <= today
        const { data: financials, error: finError } = await supabaseAdmin
          .from('datos_financieros')
          .select(`
            ticker,
            period_end_date,
            roic,
            operating_margin,
            net_margin,
            fcf_margin,
            debt_to_equity,
            interest_coverage
          `)
          .in('ticker', chunk)
          .in('period_type', ['TTM', 'FY'])
          .lte('period_end_date', today) 
          .order('period_end_date', { ascending: false });

        if (finError) {
             console.error('Error fetching financials chunk:', finError);
             continue;
        }

        if (!financials) continue;

        // Dedupe within chunk (keep latest per ticker)
        const processedInChunk = new Set<string>();
        
        for (const fin of financials) {
            if (processedInChunk.has(fin.ticker)) continue;
            processedInChunk.add(fin.ticker);
            financialsCount++;

            const sector = tickerSectorMap.get(fin.ticker) || null;
            const industry = tickerIndustryMap.get(fin.ticker) || null;

            pushToBucket(sector, industry, 'roic', fin.roic);
            pushToBucket(sector, industry, 'operating_margin', fin.operating_margin);
            pushToBucket(sector, industry, 'net_margin', fin.net_margin);
            pushToBucket(sector, industry, 'fcf_margin', fin.fcf_margin);
            pushToBucket(sector, industry, 'debt_to_equity', fin.debt_to_equity);
            pushToBucket(sector, industry, 'interest_coverage', fin.interest_coverage);
        }
    }
    
    console.log(`✅ Financials resolved: ${financialsCount} records used.`);

    // ─────────────────────────────────────────
    // 4. BUILD BENCHMARKS
    // ─────────────────────────────────────────
    
    const benchmarksToUpsert: any[] = [];
    const skippedSectors = new Set<string>();
    const lowConfidenceSectors = new Set<string>();

    const processBuckets = (buckets: Record<string, Record<string, number[]>>, isIndustry: boolean) => {
      for (const [groupName, metrics] of Object.entries(buckets)) {
        
        // Validation: Log missing mandatory metrics for Sectors
        if (!isIndustry) {
             const missingMandatory = [];
             for (const m of BENCHMARK_METRICS) {
                 if (!metrics[m] || metrics[m].length === 0) {
                     missingMandatory.push(m);
                 }
             }
             if (missingMandatory.length > 0) {
                 console.log(`⚠️ Missing data for Sector: ${groupName} -> ${missingMandatory.join(', ')}`);
             }
        }

        for (const [metricName, values] of Object.entries(metrics)) {
          const benchmark = buildSectorBenchmark(values);
          
          if (!benchmark) {
            skippedSectors.add(`${groupName} (${metricName})`);
            continue;
          }

          if (benchmark.confidence === 'low') {
            lowConfidenceSectors.add(`${groupName}`);
          }

          benchmarksToUpsert.push({
            sector: groupName, 
            snapshot_date: today,
            metric: metricName,
            sample_size: benchmark.sample_size,
            confidence: benchmark.confidence, 
            p10: benchmark.p10,
            p25: benchmark.p25,
            p50: benchmark.p50,
            p75: benchmark.p75,
            p90: benchmark.p90,
            median: benchmark.median,
            trimmed_mean: benchmark.trimmed_mean,
            uncertainty_range: benchmark.uncertainty_range
          });
        }
      }
    };

    processBuckets(sectorBuckets, false);
    processBuckets(industryBuckets, true);

    // ─────────────────────────────────────────
    // 5. UPSERT TO DB
    // ─────────────────────────────────────────
    if (benchmarksToUpsert.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('sector_benchmarks')
        .upsert(benchmarksToUpsert, { 
          onConflict: 'sector, snapshot_date, metric' 
        });
      
      if (upsertError) throw upsertError;
    }

    // ─────────────────────────────────────────
    // 6. LOGGING & STATE UPDATE
    // ─────────────────────────────────────────
    console.log(`📊 Benchmarks built: ${benchmarksToUpsert.length}`);
    if (skippedSectors.size > 0) {
      console.log(`⚠️ Skipped (Sample < 3): ${skippedSectors.size} sector-metrics`);
    }
    if (lowConfidenceSectors.size > 0) {
      console.log(`⚠️ Low Confidence (3 <= Sample < 10): ${Array.from(lowConfidenceSectors).slice(0, 5).join(', ')}...`);
    }

    await supabaseAdmin
      .from('cron_state')
      .upsert({
        name: CRON_NAME,
        last_run_date: today
      });

    return NextResponse.json({
      success: true,
      date: today,
      benchmarks_generated: benchmarksToUpsert.length,
      skipped_metrics: skippedSectors.size,
      low_confidence_sectors: lowConfidenceSectors.size
    });

  } catch (e: any) {
    console.error('❌ SECTOR BENCHMARKS CRON ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
