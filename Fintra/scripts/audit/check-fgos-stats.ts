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
  console.log(`Checking FGOS stats for ${today}...`);

  // Count computed
  const { count: computedCount, error: err1 } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('snapshot_date', today)
    .eq('fgos_status', 'computed');

  if (err1) console.error('Error counting computed:', err1);

  // Count pending
  const { count: pendingCount, error: err2 } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('snapshot_date', today)
    .eq('fgos_status', 'pending');

  if (err2) console.error('Error counting pending:', err2);

  // Check a sample
  const { data: sample } = await supabaseAdmin
    .from('fintra_snapshots')
    .select('ticker, fgos_score, fgos_status, sector')
    .eq('snapshot_date', today)
    .eq('fgos_status', 'computed')
    .limit(5);

  console.log(`✅ Computed: ${computedCount}`);
  console.log(`⏳ Pending: ${pendingCount}`);
  console.log('Sample Computed:', sample);
}

main();
