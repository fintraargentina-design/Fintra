
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Env setup
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
} else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

async function main() {
    // Dynamic imports to ensure env is loaded first
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    const { getActiveStockTickers } = await import('@/lib/repository/active-stocks');
    const { buildSnapshotFromLocalData } = await import('@/lib/snapshots/buildSnapshotsFromLocalData');

    console.log('🚀 Starting Local Snapshot Backfill (Source: local_backfill_v1)');
    
    // 1. Get Universe
    console.log('Fetching active tickers...');
    const tickers = await getActiveStockTickers(supabaseAdmin);
    console.log(`📋 Found ${tickers.length} active tickers.`);

    const today = new Date().toISOString().slice(0, 10);
  console.log(`📅 Target Date: ${today}`);

  // Check for limit argument
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : tickers.length;
  
  const tickersToProcess = tickers.slice(0, limit);
  console.log(`Processing ${tickersToProcess.length} tickers...`);

  let stats = {
      processed: 0,
        upserted: 0,
        skipped: 0,
        with_ifs: 0,
        with_fgos: 0,
        pending_fgos: 0,
        pending_valuation: 0,
        errors: 0
    };

    const CHUNK_SIZE = 25;
    
    for (let i = 0; i < tickersToProcess.length; i += CHUNK_SIZE) {
        const chunk = tickersToProcess.slice(i, i + CHUNK_SIZE);
        
        await Promise.all(chunk.map(async (ticker) => {
            try {
                const snapshot = await buildSnapshotFromLocalData(ticker, today);
                
                if (!snapshot || (snapshot as any).status === 'skipped') {
                    stats.skipped++;
                    return;
                }

                const s = snapshot as any;

                // Upsert
                const { error } = await supabaseAdmin
                    .from('fintra_snapshots')
                    .upsert(s, { onConflict: 'ticker,snapshot_date,engine_version' });

                if (error) {
                    console.error(`❌ Error upserting ${ticker}:`, error.message);
                    stats.errors++;
                } else {
                    stats.upserted++;
                    
                    if (s.ifs) stats.with_ifs++;
                    
                    if (s.fgos_status === 'computed') stats.with_fgos++;
                    else stats.pending_fgos++;
                    
                    if (s.valuation && s.valuation.valuation_status !== 'Computed') {
                        stats.pending_valuation++;
                    }
                }
            } catch (e) {
                console.error(`❌ Exception for ${ticker}:`, e);
                stats.errors++;
            } finally {
                stats.processed++;
            }
        }));

        const progress = Math.min(i + CHUNK_SIZE, tickersToProcess.length);
        process.stdout.write(`\rProcessing... ${progress}/${tickersToProcess.length} (${((progress/tickersToProcess.length)*100).toFixed(1)}%)`);
    }

    console.log('\n\n✅ Done!');
    console.table(stats);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
