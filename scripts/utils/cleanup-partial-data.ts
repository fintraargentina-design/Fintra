import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';

// Load env - Robust check for project root
const pathsToCheck = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env.local'), // Handle running from scripts/utils
    path.resolve(process.cwd(), '../../.env')
];

let envLoaded = false;
for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
        console.log(`Loading env from: ${p}`);
        dotenv.config({ path: p });
        envLoaded = true;
        break;
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials.');
    if (!supabaseUrl) console.error('   - Missing: NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseServiceKey) console.error('   - Missing: SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    // Default to today or allow --date=YYYY-MM-DD
    const args = process.argv.slice(2);
    const dateArg = args.find(a => a.startsWith('--date='))?.split('=')[1];
    
    // Use local time to match cron behavior
    const targetDate = dateArg ? dayjs(dateArg) : dayjs();
    if (!targetDate.isValid()) {
        console.error('❌ Invalid date.');
        process.exit(1);
    }
    
    const dateStr = targetDate.format('YYYY-MM-DD');
    console.log(`🧹 Starting Cleanup for Date: ${dateStr}`);
    console.log('-------------------------------------------');

    try {
        // 1. Clean Sector Benchmarks (Dependent on Snapshots)
        console.log(`Step 1: Cleaning sector_benchmarks...`);
        const benchRes = await supabaseAdmin
            .from('sector_benchmarks')
            .delete({ count: 'exact' })
            .eq('snapshot_date', dateStr);
        
        if (benchRes.error) throw benchRes.error;
        console.log(`   ✅ Deleted ${benchRes.count} benchmarks.`);

        // 2. Clean Snapshots
        console.log(`Step 2: Cleaning fintra_snapshots...`);
        const snapRes = await supabaseAdmin
            .from('fintra_snapshots')
            .delete({ count: 'exact' })
            .eq('snapshot_date', dateStr);
            
        if (snapRes.error) throw snapRes.error;
        console.log(`   ✅ Deleted ${snapRes.count} snapshots.`);

        // 3. Optional: Check for orphan market states (advanced, maybe not needed for now)
        
        console.log('-------------------------------------------');
        console.log('✨ Cleanup Complete. You can now run the Master Cron safely.');
        console.log('   Run: npx tsx scripts/run-master-cron.ts');

    } catch (err: any) {
        console.error('❌ Cleanup Failed:', err.message);
        process.exit(1);
    }
}

main();
