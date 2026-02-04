
import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
    const { runDividendsBulkV2 } = await import('@/app/api/cron/dividends-bulk-v2/core');

    console.log('🚀 Starting Dividends V2 Bulk Process...');
    const result = await runDividendsBulkV2();

    console.log('\n✅ Process Completed.');
    console.log('-----------------------------------');
    console.log(`Processed Tickers: ${result.processed}`);
    console.log(`Skipped Tickers:   ${result.skipped}`);
    console.log(`Inserted Rows:     ${result.inserted}`);
    console.log(`Errors:            ${result.errors}`);
    
    if (result.details.length > 0) {
        console.log('\n--- Details ---');
        // Show first 20 details to avoid spam
        console.log(result.details.slice(0, 20).join('\n'));
        if (result.details.length > 20) {
            console.log(`... and ${result.details.length - 20} more.`);
        }
    }
}

main().catch(console.error);
