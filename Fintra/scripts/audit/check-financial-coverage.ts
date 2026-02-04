
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCoverage() {
  const startYear = 2014;
  const endYear = 2026; // Current year or slightly future
  const results: Record<number, Record<string, number>> = {};

  console.log('Checking Financial Data Coverage (2014-2026)...');
  console.log('Year |   FY   |   Q1   |   Q2   |   Q3   |   Q4   ');
  console.log('-----|--------|--------|--------|--------|--------');

  for (let year = startYear; year <= endYear; year++) {
    const rowCounts: Record<string, number> = { FY: 0, Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

    // Check FY
    const { count: fyCount, error: fyError } = await supabase
      .from('datos_financieros')
      .select('*', { count: 'exact', head: true })
      .eq('period_type', 'FY')
      .eq('period_label', `${year}`);
    
    if (!fyError) rowCounts.FY = fyCount || 0;

    // Check Quarters
    for (let q = 1; q <= 4; q++) {
      const qLabel = `Q${q}`;
      const { count: qCount, error: qError } = await supabase
        .from('datos_financieros')
        .select('*', { count: 'exact', head: true })
        .eq('period_type', 'Q')
        .eq('period_label', `${year}${qLabel}`);
      
      if (!qError) rowCounts[qLabel] = qCount || 0;
    }

    results[year] = rowCounts;
    
    console.log(
      `${year} | ${pad(rowCounts.FY)} | ${pad(rowCounts.Q1)} | ${pad(rowCounts.Q2)} | ${pad(rowCounts.Q3)} | ${pad(rowCounts.Q4)}`
    );
  }
}

function pad(num: number) {
  return num.toString().padStart(6, ' ');
}

checkCoverage();
