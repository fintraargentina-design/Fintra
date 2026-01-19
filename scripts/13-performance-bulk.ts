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
        const { runPerformanceBulk } = await import('@/app/api/cron/performance-bulk/core');
        
        // Check for CLI args: npx tsx scripts/run-performance-bulk.ts [LIMIT] [TICKER]
        const args = process.argv.slice(2);
        const limit = args[0] ? parseInt(args[0], 10) : 100; // Default limit 100 for safety
        const ticker = args[1] || undefined;

        console.log(`🚀 Starting Performance Bulk...`);
        if (ticker) {
            console.log(`🎯 Targeting single ticker: ${ticker}`);
            await runPerformanceBulk(ticker);
        } else {
            console.log(`🧪 Batch mode with LIMIT=${limit}`);
            await runPerformanceBulk(undefined, limit);
        }
        
        console.log('✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
