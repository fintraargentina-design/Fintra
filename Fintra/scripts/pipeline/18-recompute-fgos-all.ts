import { loadEnv } from '../utils/load-env';

loadEnv();

async function main() {
    // Dynamic imports
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { runRecomputeFGOSBulk } = await import('@/app/api/cron/recompute-fgos-bulk/core');

    const today = new Date().toISOString().slice(0, 10);
    console.log(`🚀 Starting FGOS Recompute for ALL sectors (Date: ${today})`);

    // 1. Fetch all tickers with snapshots today
    console.log('📥 Fetching snapshots...');
    let allTickers: string[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;

    while (true) {
        const { data, error } = await supabaseAdmin
            .from('fintra_snapshots')
            .select('ticker')
            .eq('snapshot_date', today)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error('Error fetching snapshots:', error);
            process.exit(1);
        }

        if (!data || data.length === 0) break;

        data.forEach(d => allTickers.push(d.ticker));
        
        if (data.length < PAGE_SIZE) break;
        page++;
    }

    console.log(`📋 Found ${allTickers.length} snapshots for today.`);

    if (allTickers.length === 0) {
        console.log('⚠️ No snapshots found. Make sure FMP Bulk has run for today.');
        process.exit(0);
    }

    // 2. Process in chunks
    let success = 0;
    let pending = 0;
    let failed = 0;

    const CHUNK_SIZE = 50; // Increased for Bulk Processing
    const TOTAL = allTickers.length;

    for (let i = 0; i < TOTAL; i += CHUNK_SIZE) {
        const chunk = allTickers.slice(i, i + CHUNK_SIZE);
        
        try {
            const results = await runRecomputeFGOSBulk(chunk, today);
            
            results.forEach(res => {
                if (res.status === 'computed') {
                    success++;
                } else if (res.status === 'error') {
                    failed++;
                } else {
                    pending++;
                }
            });
        } catch (err) {
            console.error(`❌ Critical Batch Error:`, err);
            failed += chunk.length;
        }

        // Progress bar
        const progress = Math.min(i + CHUNK_SIZE, TOTAL);
        const percent = ((progress / TOTAL) * 100).toFixed(1);
        process.stdout.write(`\rProcessing: ${progress}/${TOTAL} (${percent}%) | ✅ OK: ${success} | ⏳ Pending: ${pending} | ❌ Fail: ${failed}`);
    }

    console.log('\n✅ FGOS Recompute Finished.');
}

main();
