
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
}

async function main() {
    const { supabaseAdmin } = await import('@/lib/supabase-admin');
    
    console.log('Fetching a sample of snapshots to analyze columns...');
    
    // Fetch 1000 rows to get a good statistical sample
    const { data: rows, error } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(1000);

    if (error) {
        console.error('Error fetching snapshots:', error);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log('No snapshots found.');
        return;
    }

    console.log(`Analyzing ${rows.length} rows...`);

    const allKeys = Object.keys(rows[0]);
    const nullCounts: Record<string, number> = {};
    const totalRows = rows.length;

    // Initialize counts
    allKeys.forEach(key => nullCounts[key] = 0);

    // Count nulls
    rows.forEach(row => {
        allKeys.forEach(key => {
            const val = row[key];
            if (val === null || val === undefined) {
                nullCounts[key]++;
            } else if (typeof val === 'object' && Object.keys(val).length === 0) {
                // Check for empty objects/arrays if JSONB
                // But be careful, an empty object might be valid data.
                // For now, let's strictly check for NULL in SQL sense.
                // Actually, let's treat "empty object" as data present.
            }
        });
    });

    console.log('\n--- Empty Columns (100% NULL) ---');
    const emptyColumns: string[] = [];
    const partialColumns: string[] = [];
    const fullColumns: string[] = [];

    allKeys.forEach(key => {
        const count = nullCounts[key];
        const pct = (count / totalRows) * 100;
        
        if (count === totalRows) {
            emptyColumns.push(key);
            console.log(`❌ ${key}`);
        } else if (count > 0) {
            partialColumns.push(`${key} (${pct.toFixed(1)}% null)`);
        } else {
            fullColumns.push(key);
        }
    });

    console.log('\n--- Partially Empty Columns ---');
    partialColumns.forEach(c => console.log(`⚠️  ${c}`));

    console.log('\n--- Full Columns (100% Populated) ---');
    fullColumns.forEach(c => console.log(`✅ ${c}`));
}

main();
