
import dotenv from 'dotenv';
import path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envLocalPath, override: true });

async function main() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');

    console.log('📊 Checking financial data history in Supabase...');

    // Check earliest date
    const { data: oldest, error: minError } = await supabaseAdmin
        .from('datos_financieros')
        .select('period_end_date, ticker, period_label')
        .order('period_end_date', { ascending: true })
        .limit(1);

    if (minError) {
        console.error('❌ Error fetching oldest record:', minError);
    } else {
        console.log('📅 Oldest record found:', oldest?.[0] || 'None');
    }

    // Check latest date
    const { data: newest, error: maxError } = await supabaseAdmin
        .from('datos_financieros')
        .select('period_end_date, ticker, period_label')
        .order('period_end_date', { ascending: false })
        .limit(1);

    if (maxError) {
        console.error('❌ Error fetching newest record:', maxError);
    } else {
        console.log('📅 Newest record found:', newest?.[0] || 'None');
    }

    console.log('\n🔍 Sampling counts by year:');
    const years = [2013, 2014, 2015, 2020, 2024, 2025, 2026];
    
    for (const year of years) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        const { count, error } = await supabaseAdmin
            .from('datos_financieros')
            .select('*', { count: 'exact', head: true })
            .gte('period_end_date', startDate)
            .lte('period_end_date', endDate);
            
        if (error) console.error(`   Error counting ${year}:`, error);
        else console.log(`   - ${year}: ${count} records`);
    }
}

main();
