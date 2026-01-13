import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
} else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

async function main() {
    // Dynamic imports
    const { runSectorBenchmarks } = await import('@/app/api/cron/sector-benchmarks/core');
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { recomputeFGOSForTicker } = await import('@/lib/engine/fgos-recompute');

    console.log('📊 Computing Sector Benchmarks (Step 6)...');
    try {
        await runSectorBenchmarks();
    } catch (e) {
        console.error('Benchmarks failed:', e);
        process.exit(1);
    }
    
    console.log('\n🔄 Recomputing FGOS for all snapshots (Step 4 Fix)...');
    const today = new Date().toISOString().slice(0, 10);
    
    // Fetch all snapshots
    let allTickers: string[] = [];
    let page = 0;
    const PAGE_SIZE = 1000;
    
    console.log('📥 Fetching snapshots...');
    while (true) {
        const { data, error } = await supabaseAdmin
            .from('fintra_snapshots')
            .select('ticker')
            .eq('snapshot_date', today)
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) {
            console.error(error);
            break;
        }
        if (!data || data.length === 0) break;
        
        allTickers.push(...data.map(d => d.ticker));
        if (data.length < PAGE_SIZE) break;
        page++;
    }
    
    console.log(`📋 Found ${allTickers.length} snapshots to recompute.`);

    // Recompute in chunks
    let success = 0;
    let pending = 0;
    let failed = 0;
    const CHUNK_SIZE = 50;

    for (let i = 0; i < allTickers.length; i += CHUNK_SIZE) {
        const chunk = allTickers.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (ticker) => {
            try {
                const res: any = await recomputeFGOSForTicker(ticker, today);
                const status = res.fgos_status || res.status;
                if (status === 'computed') success++;
                else pending++;
            } catch (e) {
                failed++;
            }
        }));
        
        const current = Math.min(i + CHUNK_SIZE, allTickers.length);
        process.stdout.write(`\rProgress: ${current}/${allTickers.length} | ✅ Computed: ${success} | ⏳ Pending: ${pending} | ❌ Failed: ${failed}`);
    }
    
    console.log('\n✅ FGOS Recompute Complete.');
}

main();
