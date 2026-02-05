import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
	// Dynamic imports to ensure env vars are loaded first
	const { runSyncUniverse } = await import('@/app/api/cron/sync-universe/core');
	const { runIndustryClassificationSync } = await import('@/app/api/cron/industry-classification-sync/core');
	const { runPricesDailyBulk } = await import('@/app/api/cron/prices-daily-bulk/core');
	const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
	const { runCompanyProfileBulk } = await import('@/app/api/cron/company-profile-bulk/core');
	const { runIndustryPerformanceAggregator } = await import('@/app/api/cron/industry-performance-aggregator/core');
	const { runSectorPerformanceAggregator } = await import('@/app/api/cron/sector-performance-aggregator/core');
	const { runSectorPerformanceWindowsAggregator } = await import('@/app/api/cron/sector-performance-windows-aggregator/core');
	const { runIndustryPerformanceWindowsAggregator } = await import('@/app/api/cron/industry-performance-windows-aggregator/core');
	const { runSectorPeAggregator } = await import('@/app/api/cron/sector-pe-aggregator/core');
	const { runIndustryPeAggregator } = await import('@/app/api/cron/industry-pe-aggregator/core');
	const { runSectorBenchmarks } = await import('@/app/api/cron/sector-benchmarks/core');
	const { runPerformanceBulk } = await import('@/app/api/cron/performance-bulk/core');
	const { runMarketStateBulk } = await import('@/app/api/cron/market-state-bulk/core');
	const { runDividendsBulkV2 } = await import('@/app/api/cron/dividends-bulk-v2/core');
	const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');
	const { checkSnapshotsHealth } = await import('@/app/api/cron/healthcheck-fmp-bulk/core');

    // Parse limit from CLI args, default to 0 (ALL)
	const args = process.argv.slice(2);
	const limitArg = args[0] ? parseInt(args[0], 10) : 0;
	const LIMIT = isNaN(limitArg) ? 0 : limitArg;

	console.log(`🚀 [Script] Starting Master Cron (ALL) with LIMIT=${LIMIT === 0 ? 'ALL' : LIMIT}...`);

    try {
		// 1. Sync Universe
		console.log('\n--- 1. Sync Universe ---');
		await runSyncUniverse();

		// 2. Industry Classification Sync
		console.log('\n--- 2. Industry Classification Sync ---');
		await runIndustryClassificationSync();

		// 3. Prices Daily Bulk
		console.log('\n--- 3. Prices Daily Bulk ---');
		await runPricesDailyBulk({ limit: LIMIT });

		// 4. Financials Bulk
		console.log('\n--- 4. Financials Bulk ---');
		await runFinancialsBulk(undefined, LIMIT);

		// 4b. TTM Valuation Incremental
		console.log('\n--- 4b. TTM Valuation Incremental ---');
		const { runTTMValuationCron } = await import('@/scripts/pipeline/ttm-valuation-cron');
		await runTTMValuationCron();

		// 5. Company Profile Bulk
		console.log('\n--- 5. Company Profile Bulk ---');
		await runCompanyProfileBulk(LIMIT);

		// 6. Industry Performance Aggregator (1D)
		console.log('\n--- 6. Industry Performance Aggregator (1D) ---');
		await runIndustryPerformanceAggregator();

		// 7. Sector Performance Aggregator (1D)
		console.log('\n--- 7. Sector Performance Aggregator (1D) ---');
		await runSectorPerformanceAggregator();

		// 8. Sector Performance Windows Aggregator
		console.log('\n--- 8. Sector Performance Windows Aggregator ---');
		await runSectorPerformanceWindowsAggregator();

		// 9. Industry Performance Windows Aggregator
		console.log('\n--- 9. Industry Performance Windows Aggregator ---');
		await runIndustryPerformanceWindowsAggregator();

		// 10. Sector PE Aggregator
		console.log('\n--- 10. Sector PE Aggregator ---');
		await runSectorPeAggregator();

		// 11. Industry PE Aggregator
		console.log('\n--- 11. Industry PE Aggregator ---');
		await runIndustryPeAggregator();

		// 12. Sector Benchmarks
		console.log('\n--- 12. Sector Benchmarks ---');
		await runSectorBenchmarks();

		// 13. Performance Bulk (ticker)
		console.log('\n--- 13. Performance Bulk (ticker) ---');
		await runPerformanceBulk(undefined, LIMIT);

		// 14. Market State Bulk
		console.log('\n--- 14. Market State Bulk ---');
		await runMarketStateBulk(undefined, LIMIT);

		// 15. Dividends Bulk V2
		console.log('\n--- 15. Dividends Bulk (V2) ---');
		await runDividendsBulkV2();

		// 16. FMP Bulk Snapshots (buildSnapshots)
		console.log('\n--- 16. FMP Bulk (Snapshots) ---');
		await runFmpBulk(undefined, LIMIT);

		// 17. Healthcheck Snapshots
		console.log('\n--- 17. Healthcheck Snapshots ---');
		await checkSnapshotsHealth();

		// 18. Recompute FGOS (Final Step)
		console.log('\n--- 18. Recompute FGOS (Final Step) ---');
		const { supabaseAdmin } = await import('@/lib/supabase-admin');
		const { recomputeFGOSForTicker } = await import('@/lib/engine/fgos-recompute');

		const today = new Date().toISOString().slice(0, 10);
		console.log(`🚀 Starting FGOS Recompute for ALL sectors (Date: ${today})`);

		// Fetch all tickers with snapshots today
		console.log('📥 Fetching snapshots...');
		let allTickers: string[] = [];
		let page = 0;
		const PAGE_SIZE = 1000;

		while (true) {
			const { data, error } = await supabaseAdmin
				.from('fintra_snapshots')
				.select('ticker')
				.eq('snapshot_date', today)
				.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

			if (error) {
				console.error('Error fetching snapshots:', error);
				// Don't exit process, just log error and continue to finish script
				break;
			}

			if (!data || data.length === 0) break;

			data.forEach(d => allTickers.push(d.ticker));
			
			if (data.length < PAGE_SIZE) break;
			page++;
		}

		console.log(`📋 Found ${allTickers.length} snapshots for today.`);

		if (allTickers.length > 0) {
			let success = 0;
			let pending = 0;
			let failed = 0;

			const CHUNK_SIZE = 25;
			const TOTAL = allTickers.length;

			for (let i = 0; i < TOTAL; i += CHUNK_SIZE) {
				const chunk = allTickers.slice(i, i + CHUNK_SIZE);
				
				await Promise.all(chunk.map(async (ticker) => {
					try {
						const res: any = await recomputeFGOSForTicker(ticker, today);
						const status = res.fgos_status || res.status;
						if (status === 'computed') success++;
						else pending++;
					} catch (err) {
						failed++;
					}
				}));

				const progress = Math.min(i + CHUNK_SIZE, TOTAL);
				const percent = ((progress / TOTAL) * 100).toFixed(1);
				process.stdout.write(`\rProcessing: ${progress}/${TOTAL} (${percent}%) | ✅ OK: ${success} | ⏳ Pending: ${pending} | ❌ Fail: ${failed}`);
			}
			console.log('\n✅ FGOS Recompute Finished.');
		} else {
			console.log('⚠️ No snapshots found for FGOS recompute.');
		}

		console.log('\n✅ Master Cron (ALL) Finished Successfully');
    } catch (error) {
        console.error('\n❌ Master Cron Failed:', error);
        process.exit(1);
    }
}

main();
