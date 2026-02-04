
import dotenv from 'dotenv';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });

async function main() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    
    console.log('Checking sector_performance table...');
    const { count, error } = await supabaseAdmin
        .from('sector_performance')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`Total rows in sector_performance: ${count}`);
    }

    console.log('Checking recent sector_performance...');
    const { data } = await supabaseAdmin
        .from('sector_performance')
        .select('*')
        .order('performance_date', { ascending: false })
        .limit(5);
    
    console.log('Recent rows:', data);
}

main();
