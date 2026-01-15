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
    const { runPricesDailyBulk } = await import('@/app/api/cron/prices-daily-bulk/core');
    const { runFinancialsBulk } = await import('@/app/api/cron/financials-bulk/core');
    const { runFmpBulk } = await import('@/app/api/cron/fmp-bulk/core');
    const { runCompanyProfileBulk } = await import('@/app/api/cron/company-profile-bulk/core');
    const { runValuationBulk } = await import('@/app/api/cron/valuation-bulk/core');
    const { runSectorBenchmarks } = await import('@/app/api/cron/sector-benchmarks/core');
    const { runPerformanceBulk } = await import('@/app/api/cron/performance-bulk/core');
    const { runMarketStateBulk } = await import('@/app/api/cron/market-state-bulk/core');
    const { runDividendsBulk } = await import('@/app/api/cron/dividends-bulk/core');

    // Parse limit from CLI args, default to 0 (ALL)
    const args = process.argv.slice(2);
    const limitArg = args[0] ? parseInt(args[0], 10) : 0;
    const LIMIT = isNaN(limitArg) ? 0 : limitArg;

    console.log(`🚀 [Script] Starting Master Cron with LIMIT=${LIMIT === 0 ? 'ALL' : LIMIT}...`);

    try {
        // 1. Sync Universe
        console.log('\n--- 1. Sync Universe ---');
        await runSyncUniverse();

        // 2. Prices Daily
        console.log('\n--- 2. Prices Daily ---');
        await runPricesDailyBulk({ limit: LIMIT });

        // 3. Financials
        console.log('\n--- 3. Financials Bulk ---');
        await runFinancialsBulk(undefined, LIMIT);

        // 4. Snapshots
        console.log('\n--- 4. FMP Bulk (Snapshots) ---');
        await runFmpBulk(undefined, LIMIT);

        // 4.5 Company Profile
        console.log('\n--- 4.5 Company Profile ---');
        await runCompanyProfileBulk(LIMIT);

        // 5. Valuation
        console.log('\n--- 5. Valuation Bulk ---');
        await runValuationBulk({ debugMode: false, limit: LIMIT });

        // 6. Sector Benchmarks
        console.log('\n--- 6. Sector Benchmarks ---');
        await runSectorBenchmarks();

        // 7. Performance
        console.log('\n--- 7. Performance Bulk ---');
        await runPerformanceBulk(undefined, LIMIT);

        // 8. Market State
        console.log('\n--- 8. Market State Bulk ---');
        await runMarketStateBulk(undefined, LIMIT);

        console.log('\n--- 9. Dividends Bulk ---');
        await runDividendsBulk();

        console.log('\n✅ Master Cron Finished Successfully');
    } catch (error) {
        console.error('\n❌ Master Cron Failed:', error);
        process.exit(1);
    }
}

main();
