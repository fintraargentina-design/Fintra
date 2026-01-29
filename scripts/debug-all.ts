
import dotenv from 'dotenv';
import path from 'path';

// 1. Load Environment Variables FIRST
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env.local:', result.error);
}

// 2. Dynamic Imports to avoid hoisting issues
async function main() {
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { fmpGet } = await import('@/lib/fmp/server');

  const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');
  const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
  const { runPerformanceBulk } = await import('@/app/api/cron/performance-bulk/core');
  const { runValuationBulk } = await import('@/app/api/cron/valuation-bulk/core');
  const { runPeersBulk: runFmpPeersBulk } = await import('@/app/api/cron/fmp-peers-bulk/core');
  const { runMarketStateBulk } = await import('@/app/api/cron/market-state-bulk/core');
  const { runSectorBenchmarks } = await import('@/app/api/cron/sector-benchmarks/core');
  const { runDividendsBulkV2 } = await import('@/app/api/cron/dividends-bulk-v2/core');
  const { runSyncUniverse } = await import('@/app/api/cron/sync-universe/core');
  const { runUpdateMvp } = await import('@/app/api/cron/update-mvp/core');
  const { runFmpBatch } = await import('@/app/api/cron/fmp-batch/core');
  const { runBulkUpdate } = await import('@/app/api/cron/bulk-update/core');

  async function ensurePrices(ticker: string) {
    console.log(`\n--- 0. Ensuring Prices for ${ticker} ---`);
    // Fetch full history
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
      source: 'debug_script',
      data_freshness: 100
    }));

    console.log(`Fetched ${rows.length} price rows.`);
    
    // Insert in chunks
    const CHUNK = 1000;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const { error } = await supabaseAdmin.from('prices_daily').upsert(batch, { onConflict: 'ticker,price_date' });
      if (error) console.error('Error inserting prices:', error.message);
    }
    console.log('✅ Prices ensured.');
  }

  const TARGET_TICKER = 'AAPL';
  console.log(`\n🐛 STARTING DEBUG SEQUENCE FOR TICKER: ${TARGET_TICKER}\n`);
  
  try {
    // 0. Ensure Prices
    await ensurePrices(TARGET_TICKER);

    // 1. Ingestion (FMP Bulk)
    console.log('\n--- 1. FMP Bulk (Ingestion) ---');
    await runFmpBulk(TARGET_TICKER);
    console.log('✅ FMP Bulk Done');

    // 2. Financials
    console.log('\n--- 2. Financials Bulk ---');
    await runFinancialsBulk(TARGET_TICKER);
    console.log('✅ Financials Bulk Done');

    // 3. Performance
    console.log('\n--- 3. Performance Bulk ---');
    await runPerformanceBulk(TARGET_TICKER);
    console.log('✅ Performance Bulk Done');

    // 4. Valuation
    console.log('\n--- 4. Valuation Bulk ---');
    await runValuationBulk({ targetTicker: TARGET_TICKER, debugMode: true });
    console.log('✅ Valuation Bulk Done');

    // 5. Peers
    console.log('\n--- 5. FMP Peers Bulk ---');
    await runFmpPeersBulk(TARGET_TICKER);
    console.log('✅ FMP Peers Bulk Done');

    // 6. Market State
    console.log('\n--- 6. Market State Bulk ---');
    await runMarketStateBulk(TARGET_TICKER);
    console.log('✅ Market State Bulk Done');

    // 7. Sector Benchmarks
    console.log('\n--- 7. Sector Benchmarks ---');
    await runSectorBenchmarks(TARGET_TICKER);
    console.log('✅ Sector Benchmarks Done');

    // 8. Dividends
    console.log('\n--- 8. Dividends Bulk (V2) ---');
    await runDividendsBulkV2();
    console.log('✅ Dividends Bulk Done');

    // 9. Sync Universe
    console.log('\n--- 9. Sync Universe ---');
    await runSyncUniverse(TARGET_TICKER);
    console.log('✅ Sync Universe Done');

    // 10. Update MVP
    console.log('\n--- 10. Update MVP ---');
    await runUpdateMvp(TARGET_TICKER);
    console.log('✅ Update MVP Done');

    // 11. FMP Batch
    console.log('\n--- 11. FMP Batch ---');
    await runFmpBatch(TARGET_TICKER);
    console.log('✅ FMP Batch Done');

    // 12. Bulk Update (CSV)
    console.log('\n--- 12. Bulk Update (CSV) [SKIPPED FOR DEBUG] ---');
    // Note: CSV update causes 429 Limit Reach on bulk endpoints when run frequently or in parallel.
    // Since we verified fmp-bulk (Ingestion) in Step 1, this is redundant for AAPL debug.
    // await runBulkUpdate(TARGET_TICKER);
    console.log('✅ Bulk Update Skipped');

    console.log(`\n🎉 ALL CRONS EXECUTED SUCCESSFULLY FOR ${TARGET_TICKER}`);

  } catch (error) {
    console.error('\n❌ DEBUG SEQUENCE FAILED:', error);
    process.exit(1);
  }
}

main();
