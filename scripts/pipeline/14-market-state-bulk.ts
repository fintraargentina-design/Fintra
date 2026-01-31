
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
    const { runMarketStateBulk } = await import('@/app/api/cron/market-state-bulk/core');

    const args = process.argv.slice(2);
    // Usage: npx tsx scripts/run-market-state.ts [LIMIT] [TICKER]
    const limit = args[0] ? parseInt(args[0], 10) : 0; // Default 0 (ALL) if not provided
    const ticker = args[1] || undefined;

    if (ticker) {
        console.log(`🎯 Targeting single ticker: ${ticker}`);
        await runMarketStateBulk(ticker);
    } else {
        console.log(`🧪 Batch mode with LIMIT=${limit === 0 ? 'ALL' : limit}`);
        await runMarketStateBulk(undefined, limit);
    }
}

main().catch(console.error);
