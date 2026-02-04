
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSample() {
  const { data, error } = await supabase
    .from('datos_financieros')
    .select('period_type, period_label')
    .limit(20);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Sample data:', data);
}

checkSample();
