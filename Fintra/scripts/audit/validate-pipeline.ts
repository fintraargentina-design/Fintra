
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Error loading .env.local:', result.error);
}

// Tickers for Validation
// Diverse set: Different sectors, caps, and history.
const TEST_TICKERS = [
  'AAPL', 'MSFT', // Technology
  'JPM', 'BAC',   // Financial Services
  'JNJ', 'PFE',   // Healthcare
  'PG', 'KO',     // Consumer Defensive
  'XOM', 'CVX',   // Energy
  'TSLA',         // Consumer Cyclical
  'NVDA',         // Technology (Growth)
  'PLTR',         // Technology (Mid/Large Growth)
  'ARM',          // Recent IPO (2023)
  'KVYO'          // Recent IPO (2023)
];

async function main() {
  // Dynamic imports
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { fmpGet } = await import('@/lib/fmp/server');

  const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');
  const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
  const { runPerformanceBulk } = await import('@/app/api/cron/performance-bulk/core');
  const { runValuationBulk } = await import('@/app/api/cron/valuation-bulk/core');
  const { runMarketStateBulk } = await import('@/app/api/cron/market-state-bulk/core');
  const { runSectorBenchmarks } = await import('@/app/api/cron/sector-benchmarks/core');
  const { runUpdateMvp } = await import('@/app/api/cron/update-mvp/core');
  const { runSyncUniverse } = await import('@/app/api/cron/sync-universe/core'); // Optional if tickers are already active

  // Helper: Ensure Prices
  async function ensurePrices(ticker: string) {
    console.log(`\n--- Ensuring Prices for ${ticker} ---`);
    const data = await fmpGet<any>(`/api/v3/historical-price-full/${ticker}?serietype=line`);
    if (!data || !data.historical) {
      console.warn(`⚠️ No price data found for ${ticker}`);
      return;
    }

    const rows = data.historical.map((d: any) => ({
      ticker,
      price_date: d.date,
      close: d.close,
      open: d.open ?? d.close,
      high: d.high ?? d.close,
      low: d.low ?? d.close,
      volume: d.volume ?? 0,
      source: 'validation_script',
      data_freshness: 100
    }));

    // Insert in chunks
    const CHUNK = 1000;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const { error } = await supabaseAdmin.from('prices_daily').upsert(batch, { onConflict: 'ticker,price_date' });
      if (error) console.error(`Error inserting prices for ${ticker}:`, error.message);
    }
    console.log(`✅ Prices ensured for ${ticker} (${rows.length} rows)`);
  }

  // Helper: Cleanup for Idempotency / Fresh Run
  async function cleanupToday() {
      const today = new Date().toISOString().slice(0, 10);
      console.log(`\n🧹 Cleaning up data for today (${today}) to ensure fresh run...`);
      
      // Clean Sector Benchmarks for today so we can regenerate them with low density
      const { error: err1 } = await supabaseAdmin.from('sector_benchmarks').delete().eq('snapshot_date', today);
      if (err1) console.error('Error cleaning sector_benchmarks:', err1);
      
      // We don't delete snapshots/financials as upsert handles them, but benchmarks check idempotency.
      console.log('✅ Cleanup done.');
  }

  try {
    console.log(`\n🧪 STARTING PIPELINE VALIDATION TEST`);
    console.log(`Tickers: ${TEST_TICKERS.join(', ')}`);

    // 0. Cleanup
    await cleanupToday();

    // 1. Sync Universe (Ensure they are active)
    // We'll skip full sync and just ensure our test tickers are active manually or trust they are.
    // Actually, let's just run runSyncUniverse for one ticker to verify it works, 
    // but really we just need them in fintra_universe with is_active=true.
    // Let's assume they are active. If not, fmp-bulk might skip them?
    // fmp-bulk (core) usually fetches profile for targetTicker regardless of universe status? 
    // Let's check fmp-bulk core. It usually upserts to universe too.
    
    // 2. FMP Bulk (Ingestion) & Prices
    console.log('\n📦 STEP 1: Ingestion & Prices');
    for (const ticker of TEST_TICKERS) {
        await ensurePrices(ticker);
        await runFmpBulk(ticker);
    }

    // 3. Financials Bulk
    console.log('\n💰 STEP 2: Financials Bulk');
    for (const ticker of TEST_TICKERS) {
        await runFinancialsBulk(ticker);
    }

    // 4. Valuation Bulk
    console.log('\n📊 STEP 3: Valuation Bulk');
    for (const ticker of TEST_TICKERS) {
        // Use debugMode: true to fetch single-ticker data from API
        await runValuationBulk({ targetTicker: ticker, debugMode: true });
    }

    // 5. Sector Benchmarks
    // We run this ONCE. It will aggregate data from the snapshots we just created.
    // Since we only populated these 14 tickers for today, density will be low.
    console.log('\nbenchmarks STEP 4: Sector Benchmarks');
    const benchResult = await runSectorBenchmarks(); 
    console.log('Sector Benchmarks Result:', benchResult);

    // 6. FGOS (Update MVP)
    console.log('\n🧠 STEP 5: Recompute FGOS (Update MVP)');
    for (const ticker of TEST_TICKERS) {
        await runUpdateMvp(ticker);
    }

    // 7. Performance Bulk
    console.log('\n📈 STEP 6: Performance Bulk');
    for (const ticker of TEST_TICKERS) {
        await runPerformanceBulk(ticker);
    }

    // 8. Market State Bulk
    console.log('\n🌍 STEP 7: Market State Bulk');
    for (const ticker of TEST_TICKERS) {
        await runMarketStateBulk(ticker);
    }

    // --- REPORTING ---
    console.log('\n\n📋 VALIDATION REPORT GENERATION');
    
    // Check Performance Coverage
    const { data: perfData, error: perfError } = await supabaseAdmin
        .from('datos_performance')
        .select('ticker, window_code')
        .in('ticker', TEST_TICKERS)
        .order('ticker');
    
    if (perfError) console.error('Error fetching performance stats:', perfError);

    const perfMap: Record<string, string[]> = {};
    perfData?.forEach(r => {
        if (!perfMap[r.ticker]) perfMap[r.ticker] = [];
        perfMap[r.ticker].push(r.window_code);
    });

    console.log('\n1. Performance Coverage:');
    TEST_TICKERS.forEach(t => {
        const windows = perfMap[t] || [];
        console.log(`  ${t}: ${windows.length} windows [${windows.join(', ')}]`);
    });

    // Check Sector Benchmarks Density
    const today = new Date().toISOString().slice(0, 10);
    const { data: benchData, error: benchError } = await supabaseAdmin
        .from('sector_benchmarks')
        .select('sector, metric, sample_size, confidence')
        .eq('snapshot_date', today);
    
    if (benchError) console.error('Error fetching benchmarks:', benchError);

    console.log('\n2. Sector Benchmarks (Density Check):');
    if (!benchData || benchData.length === 0) {
        console.log('  ⚠️ No benchmarks generated (Expected if density < min)');
    } else {
        benchData.forEach(b => {
            console.log(`  Sector: ${b.sector} | Metric: ${b.metric} | N=${b.sample_size} | Conf=${b.confidence}`);
        });
    }

    // Check Market State
    const { data: stateData, error: stateError } = await supabaseAdmin
        .from('market_state')
        .select('ticker, state, risk_level, liquidity_status')
        .in('ticker', TEST_TICKERS);
    
    console.log('\n3. Market State:');
    stateData?.forEach(s => {
        console.log(`  ${s.ticker}: State=${s.state}, Risk=${s.risk_level}, Liq=${s.liquidity_status}`);
    });

    console.log('\n✅ VALIDATION TEST COMPLETE');

  } catch (error) {
    console.error('\n❌ PIPELINE VALIDATION FAILED:', error);
    process.exit(1);
  }
}

main();
