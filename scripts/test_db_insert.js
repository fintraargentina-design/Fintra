
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lvqfmrsvtyoemxfbnwzv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cWZtcnN2dHlvZW14ZmJud3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzIxMTE4NCwiZXhwIjoyMDY4Nzg3MTg0fQ.Ci1yxmya1JF0DSMiTagv2V4bAhacrTdW63gEZ5kH2h0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log('Testing insert into fintra_snapshots...');
  
  const dummy = {
    ticker: 'TEST_INSERT',
    fgos_score: 50,
    fgos_breakdown: {},
    ecosystem_score: 50,
    valuation_status: 'TEST',
    calculated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('fintra_snapshots')
    .insert([dummy])
    .select();

  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('Insert success:', data);
    // Cleanup
    await supabase.from('fintra_snapshots').delete().eq('ticker', 'TEST_INSERT');
  }
}

testInsert();
