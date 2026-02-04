import { loadEnv } from '../utils/load-env';

loadEnv();

// Import and run
async function main() {
    try {
        const { runIndustryPeAggregator } = await import('@/app/api/cron/industry-pe-aggregator/core');
        console.log('🚀 Starting Industry PE Aggregator...');
        await runIndustryPeAggregator();
        console.log('✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
