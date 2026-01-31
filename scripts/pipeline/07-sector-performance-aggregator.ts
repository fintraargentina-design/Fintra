import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    console.log(`Loading env from ${envLocalPath}`);
    dotenv.config({ path: envLocalPath, override: true });
} else {
    dotenv.config();
}

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
