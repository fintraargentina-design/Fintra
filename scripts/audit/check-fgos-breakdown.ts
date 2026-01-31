import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
} else {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  
  const { data, error } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('ticker, fgos_breakdown')
    .eq('snapshot_date', today)
    .eq('fgos_status', 'computed')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Breakdown check:', JSON.stringify(data, null, 2));
  }
}

main();
