const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lvqfmrsvtyoemxfbnwzv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cWZtcnN2dHlvZW14ZmJud3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzIxMTE4NCwiZXhwIjoyMDY4Nzg3MTg0fQ.Ci1yxmya1JF0DSMiTagv2V4bAhacrTdW63gEZ5kH2h0'
);

async function checkFinancialData() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  🔍 VERIFICACIÓN DE datos_financieros                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Ver estructura de datos_financieros
  const { data: sample } = await supabase
    .from('datos_financieros')
    .select('*')
    .limit(1);

  if (sample && sample.length > 0) {
    console.log('📋 COLUMNAS DISPONIBLES:');
    console.log('─'.repeat(60));
    const columns = Object.keys(sample[0]);
    const relevantCols = columns.filter(c =>
      c.includes('debt') || c.includes('equity') || c.includes('coverage') || c.includes('solvency')
    );
    console.log('Columnas de solvencia:', relevantCols.length > 0 ? relevantCols.join(', ') : 'NINGUNA');
    console.log('\nTodas las columnas:', columns.slice(0, 20).join(', ') + '...');
    console.log('');
  }

  // Verificar tickers de ejemplo
  const testTickers = ['000001.SZ', '000002.SZ', 'AAPL', 'MSFT', 'GOOGL'];

  console.log('🔎 VERIFICACIÓN DE TICKERS:');
  console.log('─'.repeat(60));

  for (const ticker of testTickers) {
    const { data } = await supabase
      .from('datos_financieros')
      .select('symbol, debt_to_equity_ttm, interest_coverage_ttm, return_on_equity_ttm, date')
      .eq('symbol', ticker)
      .order('date', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const record = data[0];
      console.log(ticker + ':');
      console.log('  D/E TTM: ' + record.debt_to_equity_ttm);
      console.log('  Interest Coverage TTM: ' + record.interest_coverage_ttm);
      console.log('  ROE TTM: ' + record.return_on_equity_ttm);
      console.log('  Fecha: ' + record.date);
    } else {
      console.log(ticker + ': NO ENCONTRADO');
    }
  }

  console.log('');

  // Estadísticas generales
  console.log('📊 ESTADÍSTICAS GENERALES:');
  console.log('─'.repeat(60));

  const { count: totalCount } = await supabase
    .from('datos_financieros')
    .select('*', { count: 'exact', head: true });

  const { count: withDebtEquity } = await supabase
    .from('datos_financieros')
    .select('*', { count: 'exact', head: true })
    .not('debt_to_equity_ttm', 'is', null);

  const { count: withInterestCoverage } = await supabase
    .from('datos_financieros')
    .select('*', { count: 'exact', head: true })
    .not('interest_coverage_ttm', 'is', null);

  console.log('Total registros: ' + (totalCount || 0).toLocaleString());
  console.log('Con debt_to_equity_ttm: ' + (withDebtEquity || 0).toLocaleString() + ' (' + ((withDebtEquity / totalCount * 100) || 0).toFixed(1) + '%)');
  console.log('Con interest_coverage_ttm: ' + (withInterestCoverage || 0).toLocaleString() + ' (' + ((withInterestCoverage / totalCount * 100) || 0).toFixed(1) + '%)');
}

checkFinancialData();
