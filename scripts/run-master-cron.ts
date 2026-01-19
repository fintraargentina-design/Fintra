import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars BEFORE importing other modules
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    console.log(`Loading env from ${envLocalPath}`);
    dotenv.config({ path: envLocalPath, override: true });
} else {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        console.log(`Loading env from ${envPath}`);
        dotenv.config({ path: envPath });
    } else {
        console.warn('⚠️ No .env or .env.local found!');
    }
}

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

		console.log('\n✅ Master Cron (ALL) Finished Successfully');
    } catch (error) {
        console.error('\n❌ Master Cron Failed:', error);
        process.exit(1);
    }
}

main();
