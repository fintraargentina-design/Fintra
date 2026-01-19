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
