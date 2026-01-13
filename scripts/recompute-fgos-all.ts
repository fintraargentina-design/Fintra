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
    // Dynamic imports
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { recomputeFGOSForTicker } = await import('@/lib/engine/fgos-recompute');

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

    const CHUNK_SIZE = 25; // Parallel processing limit
    const TOTAL = allTickers.length;

    for (let i = 0; i < TOTAL; i += CHUNK_SIZE) {
        const chunk = allTickers.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (ticker) => {
            try {
                const res: any = await recomputeFGOSForTicker(ticker, today);
                
                // Normalize status check
                const status = res.fgos_status || res.status;
                
                if (status === 'computed') {
                    success++;
                } else {
                    pending++;
                }
            } catch (err) {
                // console.error(`❌ Error ${ticker}:`, err); // Too verbose for large sets
                failed++;
            }
        }));

        // Progress bar
        const progress = Math.min(i + CHUNK_SIZE, TOTAL);
        const percent = ((progress / TOTAL) * 100).toFixed(1);
        process.stdout.write(`\rProcessing: ${progress}/${TOTAL} (${percent}%) | ✅ OK: ${success} | ⏳ Pending: ${pending} | ❌ Fail: ${failed}`);
    }

    console.log('\n✅ FGOS Recompute Finished.');
}

main();
