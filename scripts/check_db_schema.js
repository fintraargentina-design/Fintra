
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvqfmrsvtyoemxfbnwzv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cWZtcnN2dHlvZW14ZmJud3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzIxMTE4NCwiZXhwIjoyMDY4Nzg3MTg0fQ.Ci1yxmya1JF0DSMiTagv2V4bAhacrTdW63gEZ5kH2h0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking fintra_market_state schema...');
  const { data, error } = await supabase
    .from('fintra_market_state')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching fintra_market_state:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  }
}

checkSchema();
