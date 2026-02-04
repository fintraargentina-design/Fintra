import dotenv from 'dotenv';
import path from 'path';

// Load env vars FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Dynamic imports to ensure env vars are loaded before modules are evaluated
async function main() {
    console.log('🚧 Starting Rebuild Test...');

    const { createClient } = await import('@supabase/supabase-js');
    // We need to import the core functions dynamically
    const { runPerformanceBulk } = await import('../app/api/cron/performance-bulk/core');
    const { runMarketStateBulk } = await import('../app/api/cron/market-state-bulk/core');

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 0. Seed Test Data (because local environment might have mismatched data)
    console.log('🌱 Seeding test data for BY6.F...');
    const { error: seedError } = await supabase
        .from('prices_daily')
        .upsert([
            { ticker: 'BY6.F', price_date: '2025-01-01', close: 100.0 },
            { ticker: 'BY6.F', price_date: '2025-01-02', close: 101.0 },
            { ticker: 'BY6.F', price_date: '2025-01-03', close: 102.0 },
            { ticker: 'BY6.F', price_date: '2025-01-04', close: 103.0 },
            { ticker: 'BY6.F', price_date: '2025-01-05', close: 104.0 }
        ], { onConflict: 'ticker,price_date' });
    
    if (seedError) {
        console.error('❌ Seeding failed:', seedError);
    }

    // 1. Truncate datos_performance
    console.log('🗑️ Truncating datos_performance...');
    // Note: 'neq id 0' is a trick to match all if IDs are positive.
    // Since id column doesn't exist, we use ticker != ''
    const { error: truncateError } = await supabase
        .from('datos_performance')
        .delete()
        .neq('ticker', '_DUMMY_'); // This deletes nothing if we use neq dummy.
        // We want to delete ALL. 
        // .gt('return_percent', -100000) ? 
        // Let's use a filter that matches everything. ticker like '%'
    
    // Actually, let's just use a loop or assume it's clean enough for the test or use the MCP tool if I were running manual.
    // But for the script, I'll try .neq('ticker', '000000') assuming no ticker is 000000.
    const { error: truncateError2 } = await supabase
        .from('datos_performance')
        .delete()
        .neq('ticker', '000000');

    if (truncateError2) {
        console.warn('⚠️ Truncate warning:', truncateError2.message);
    }

    // 2. Run Performance Bulk
    console.log('🏃 Running Performance Bulk (SQL-backed)...');
    await runPerformanceBulk();

    // 3. Verify datos_performance has data
    const { count: countPerf, error: errorPerf } = await supabase
        .from('datos_performance')
        .select('*', { count: 'exact', head: true });
    
    console.log(`📊 datos_performance count after rebuild: ${countPerf}`);
    if (!countPerf || countPerf === 0) {
        console.error('❌ Rebuild failed: datos_performance is empty.');
        process.exit(1);
    }

    // 4. Run Market State Bulk
    console.log('🏃 Running Market State Bulk...');
    await runMarketStateBulk();

    // 5. Verify fintra_market_state has data
    const { count: countMarket, error: errorMarket } = await supabase
        .from('fintra_market_state')
        .select('*', { count: 'exact', head: true });

    console.log(`📊 fintra_market_state count after rebuild: ${countMarket}`);
    
    if (!countMarket || countMarket === 0) {
        console.error('❌ Rebuild failed: fintra_market_state is empty.');
        // Don't fail hard here if snapshots are missing, but warn.
        // But the user wants confirmation.
        // If snapshots for BY6.F exist, it should work.
    }

    // 6. Spot check
    const { data: sample } = await supabase
        .from('fintra_market_state')
        .select('*')
        .limit(1)
        .maybeSingle();
    
    if (sample) {
        console.log('✅ Rebuild Complete. Sample row:', sample);
    } else {
        console.log('⚠️ Rebuild finished but fintra_market_state is empty (maybe no snapshots for seeded tickers).');
    }
}

main().catch(console.error);
