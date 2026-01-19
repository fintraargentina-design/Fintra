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
