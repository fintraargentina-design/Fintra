
import * as dotenv from 'dotenv';
import path from 'path';

// Try loading .env first (contains keys)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Fallback to .env.local if needed (though .env usually has them)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('🔍 DEBUG ENV:');
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Loaded' : 'Missing');
console.log('KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Loaded' : 'Missing');

async function run() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('❌ Keys are missing. Cannot proceed.');
      return;
  }
  
  const { getResumenData } = await import('../lib/repository/fintra-db');
  console.log('🧪 VALIDATING FGOS PHASE 4 DATA FETCH');
  
  const tickers = ['AAPL', 'IPO_TEST'];
  
  for (const ticker of tickers) {
    console.log(`\nFetching data for ${ticker}...`);
    try {
      const data = await getResumenData(ticker);
      
      console.log('✅ Data fetched successfully.');
      console.log('FGOS Fields:');
      console.log(`- Score: ${data.fgos_score}`);
      console.log(`- Confidence Label: ${data.fgos_confidence_label}`);
      console.log(`- Status (Maturity): ${data.fgos_status}`);
      console.log(`- Confidence Percent: ${data.fgos_confidence_percent}`);
      
      if (data.fgos_status) {
          console.log('✅ Status is present.');
      } else {
          console.warn('⚠️ Status is missing.');
      }

      if (data.fgos_confidence_label) {
          console.log('✅ Confidence Label is present.');
      } else {
          console.warn('⚠️ Confidence Label is missing.');
      }
      
      if (data.fgos_confidence_percent !== null) {
          console.log('✅ Confidence Percent is present.');
      } else {
          console.warn('⚠️ Confidence Percent is missing.');
      }

    } catch (error) {
      console.error(`❌ Error fetching data for ${ticker}:`, error);
    }
  }
}

run();
