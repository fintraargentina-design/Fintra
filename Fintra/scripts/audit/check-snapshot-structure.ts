
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSnapshotStructure() {
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (data && data.length > 0) {
    const row = data[0];
    console.log('Keys in fintra_snapshots row:', Object.keys(row));
    console.log('market_state:', JSON.stringify(row.market_state, null, 2));
    console.log('market_snapshot:', JSON.stringify(row.market_snapshot, null, 2));
    console.log('ifs:', JSON.stringify(row.ifs, null, 2));
    console.log('ifs_memory:', JSON.stringify(row.ifs_memory, null, 2));
    console.log('valuation:', JSON.stringify(row.valuation, null, 2));
    console.log('profile_structural:', JSON.stringify(row.profile_structural, null, 2));
    console.log('fgos_components:', JSON.stringify(row.fgos_components, null, 2));
  } else {
    console.log('No data found in fintra_snapshots');
  }
}

checkSnapshotStructure();
