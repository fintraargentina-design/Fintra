import { loadEnv } from '../utils/load-env';

loadEnv();

// Import and run
async function main() {
    try {
        const { runSectorPeAggregator } = await import('@/app/api/cron/sector-pe-aggregator/core');
        console.log('🚀 Starting Sector PE Aggregator...');
        const result = await runSectorPeAggregator();
        console.log('✅ Done!', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
