
import { loadEnv } from '../utils/load-env';

loadEnv();

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
