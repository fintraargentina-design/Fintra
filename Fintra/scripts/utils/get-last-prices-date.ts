import dotenv from 'dotenv';
import path from 'path';

// Load env (same pattern as other scripts)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const { supabaseAdmin } = await import('../../lib/supabase-admin');

  const { data, error } = await supabaseAdmin
    .from('prices_daily')
    .select('price_date')
    .order('price_date', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error querying prices_daily:', error);
    process.exit(1);
  }

  const last = data?.[0]?.price_date || null;
  console.log('LAST_PRICE_DATE', last);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
