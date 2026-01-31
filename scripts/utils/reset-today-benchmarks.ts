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
  console.log(`🗑️  Deleting sector benchmarks for ${today}...`);

  const { error, count } = await supabaseAdmin
    .from('sector_benchmarks')
    .delete({ count: 'exact' })
    .eq('snapshot_date', today);

  if (error) {
    console.error('❌ Error deleting benchmarks:', error);
    process.exit(1);
  }

  console.log(`✅ Deleted ${count} benchmarks.`);
}

main();
