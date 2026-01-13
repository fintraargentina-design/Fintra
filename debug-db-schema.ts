
import { supabaseAdmin } from './lib/supabase-admin';

async function listTables() {
  const { data, error } = await supabaseAdmin
    .rpc('execute_sql', {
      sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    });

  if (error) {
    console.error('RPC Error:', error);
    // Fallback if RPC not available (depends on setup)
    return;
  }
  
  console.log('Tables:', data);
}

listTables().catch(console.error);
