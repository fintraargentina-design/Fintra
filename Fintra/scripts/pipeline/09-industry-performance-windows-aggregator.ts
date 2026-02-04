import { loadEnv } from '../utils/load-env';

loadEnv();

// Import and run
async function main() {
    try {
        const { runIndustryPerformanceWindowsAggregator } = await import('@/app/api/cron/industry-performance-windows-aggregator/core');
        console.log('🚀 Starting Industry Performance Windows Aggregator...');
        const result = await runIndustryPerformanceWindowsAggregator();
        console.log('✅ Done!', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
