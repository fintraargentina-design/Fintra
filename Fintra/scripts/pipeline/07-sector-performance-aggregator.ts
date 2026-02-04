import { loadEnv } from '../utils/load-env';

loadEnv();

// Import and run
async function main() {
    try {
        const { runSectorPerformanceAggregator } = await import('@/app/api/cron/sector-performance-aggregator/core');
        console.log('🚀 Starting Sector Performance Aggregator...');
        const result = await runSectorPerformanceAggregator();
        console.log('✅ Done!', result);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
