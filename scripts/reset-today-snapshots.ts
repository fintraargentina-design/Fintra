import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
} else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

async function main() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    
    const today = new Date().toISOString().slice(0, 10);
    console.log(`🗑️  Deleting snapshots for ${today}...`);
    
    const { error, count } = await supabaseAdmin
        .from('fintra_snapshots')
        .delete({ count: 'exact' })
        .eq('snapshot_date', today);
    
    if (error) {
        console.error('❌ Delete failed:', error);
        process.exit(1);
    }
    
    console.log(`✅ Deleted ${count} snapshots.`);
}

main();
