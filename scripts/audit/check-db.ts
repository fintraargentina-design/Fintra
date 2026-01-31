import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
}

async function main() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    
    console.log('Checking snapshots...');
    const { data, error } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('snapshot_date, ticker')
        .limit(10);
        
    if (error) console.error(error);
    else {
        console.log('Sample data:', data);
        
        // Count by date
        const { data: allDates } = await supabaseAdmin
            .from('fintra_snapshots')
            .select('snapshot_date');
            
        const counts: Record<string, number> = {};
        allDates?.forEach((d: any) => {
            counts[d.snapshot_date] = (counts[d.snapshot_date] || 0) + 1;
        });
        console.log('Counts by date:', counts);
    }
}
main();
