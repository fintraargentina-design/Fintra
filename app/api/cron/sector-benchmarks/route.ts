import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { buildSectorBenchmark } from '@/lib/engine/buildSectorBenchmark';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_NAME = 'sector_stats_builder';

// Metrics derived from Snapshot (Daily Valuation + Computed Growth)
const SNAPSHOT_METRICS = [
  'pe_ratio',
  'ev_ebitda',
  'price_to_fcf',
  'revenue_cagr',
  'earnings_cagr',
  'fcf_cagr'
] as const;

// Metrics derived from Financials (Quarterly/Annual)
const FINANCIAL_METRICS = [
  'roic',
  'operating_margin',
  'net_margin',
  'fcf_margin',
  'debt_to_equity',
  'interest_coverage'
] as const;

type MetricName = (typeof SNAPSHOT_METRICS)[number] | (typeof FINANCIAL_METRICS)[number];

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`🚀 Starting ${CRON_NAME} for ${today}`);

  try {
    // ─────────────────────────────────────────
    // 1. CHECK CURSOR (Idempotency)
    // ─────────────────────────────────────────
    const { data: state } = await supabaseAdmin
      .from('cron_state')
      .select('last_run_date')
      .eq('name', CRON_NAME)
      .single();

    if (state?.last_run_date === today) {
      console.log('✅ Already run today. Skipping.');
      return NextResponse.json({ skipped: true, date: today });
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

    // Process Snapshots
    const activeTickers: string[] = [];

    for (const snap of validSnapshots) {
      const ticker = snap.ticker;
      // Fallback sector logic if root sector is missing (shouldn't happen in valid snapshots but safe to check)
      const sector = snap.sector || snap.profile_structural?.classification?.sector;
      const industry = snap.profile_structural?.classification?.industry;

      if (!sector) continue; // Skip if no sector (cannot benchmark)

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
    // Fetch latest TTM/FY data for active tickers
    // We chunk the request if too many tickers (Supabase limit safe-guard)
    // But usually 2000-3000 tickers is fine in one IN query. 
    // If it exceeds, we might need chunking. For now assuming < 5000.
    
    // We only need the latest record. We'll fetch all matching TTM/FY and dedupe in memory.
    // Optimization: filtering by period_end_date > 18 months ago to avoid stale data? 
    // Let's rely on sorting.
    
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
      .in('ticker', activeTickers)
      .in('period_type', ['TTM', 'FY'])
      .order('period_end_date', { ascending: false });

    if (finError) throw finError;

    // Dedupe: Keep only the first (latest) record per ticker
    const processedTickers = new Set<string>();

    for (const fin of financials || []) {
      if (processedTickers.has(fin.ticker)) continue;
      processedTickers.add(fin.ticker);

      const sector = tickerSectorMap.get(fin.ticker) || null;
      const industry = tickerIndustryMap.get(fin.ticker) || null;

      // Push Financial Metrics
      pushToBucket(sector, industry, 'roic', fin.roic);
      pushToBucket(sector, industry, 'operating_margin', fin.operating_margin);
      pushToBucket(sector, industry, 'net_margin', fin.net_margin);
      pushToBucket(sector, industry, 'fcf_margin', fin.fcf_margin);
      pushToBucket(sector, industry, 'debt_to_equity', fin.debt_to_equity);
      pushToBucket(sector, industry, 'interest_coverage', fin.interest_coverage);
    }

    // ─────────────────────────────────────────
    // 4. BUILD BENCHMARKS
    // ─────────────────────────────────────────
    
    const benchmarksToUpsert: any[] = [];
    const skippedSectors = new Set<string>();
    const lowConfidenceSectors = new Set<string>();

    // Helper to process a bucket set (Sectors or Industries)
    const processBuckets = (buckets: Record<string, Record<string, number[]>>, isIndustry: boolean) => {
      for (const [groupName, metrics] of Object.entries(buckets)) {
        for (const [metricName, values] of Object.entries(metrics)) {
          
          const benchmark = buildSectorBenchmark(values);
          
          // RULE 1: sample_size < 3 -> Do NOT build (returns null)
          if (!benchmark) {
            skippedSectors.add(`${groupName} (${metricName})`);
            continue;
          }

          // Logging logic
          if (benchmark.confidence === 'low') {
            lowConfidenceSectors.add(`${groupName}`);
          }

          // Prepare Row
          // We write to 'sector_benchmarks' table
          // Note: We use the 'sector' column for both Sector and Industry identifiers
          benchmarksToUpsert.push({
            sector: groupName, 
            snapshot_date: today,
            metric: metricName,
            sample_size: benchmark.sample_size,
            confidence: benchmark.confidence, // Matches table column
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

    // Process Sectors
    processBuckets(sectorBuckets, false);

    // Process Industries
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
