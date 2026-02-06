import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllFmpData } from '@/app/api/cron/fmp-bulk/fetchBulk';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';

/**
 * CORE LOGIC: Company Profile Bulk
 * 
 * Fetches profile data from FMP (bulk) and upserts into company_profile table.
 * Reference Data Layer.
 */
export async function runCompanyProfileBulk(limit?: number) {
  const fmpKey = process.env.FMP_API_KEY!;
  if (!fmpKey) {
      throw new Error('Missing FMP_API_KEY env var');
  }

  console.log('🚀 Starting Company Profile Bulk Update...');

  // 1. Fetch Profiles from FMP (Cached)
  const { ok, data: profiles, error } = await fetchAllFmpData('profiles', fmpKey);
  if (!ok || !profiles) {
    throw new Error(`Failed to fetch profiles: ${error?.message}`);
  }
  console.log(`📥 Downloaded ${profiles.length} raw profiles.`);

  // 2. Fetch Active Universe
  // We only want to store profiles for tickers present in fintra_universe (active)
  const activeTickers = await getActiveStockTickers(supabaseAdmin);
  const activeSet = new Set(activeTickers);
  console.log(`📋 Active Universe: ${activeSet.size} tickers.`);

  // 3. Filter & Transform
  const rows = [];
  let processed = 0;

  for (const p of profiles) {
    const ticker = p.symbol || p.ticker;
    if (!ticker) continue;
    
    // Only active tickers
    if (!activeSet.has(ticker)) continue;

    // Apply Limit if needed (for testing)
    if (limit && limit > 0 && processed >= limit) break;

    // Parse employees
    let employees = null;
    if (p.fullTimeEmployees) {
        const parsed = parseInt(String(p.fullTimeEmployees).replace(/,/g, ''), 10);
        if (!isNaN(parsed)) employees = parsed;
    }

    rows.push({
      ticker: ticker,
      company_name: p.companyName || null,
      description: p.description || null,
      sector: p.sector || null,
      industry: p.industry || null,
      country: p.country || null,
      website: p.website || null,
      ceo: p.ceo || null,
      employees: employees,
      source: 'fmp',
      updated_at: new Date().toISOString()
    });

    processed++;
  }

  console.log(`✨ Prepared ${rows.length} profile rows for upsert.`);

  // 4. Upsert in Batches with Concurrency
  const BATCH_SIZE = 500;
  const CONCURRENCY = 5; // Parallel requests
  let upserted = 0;
  
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`⚡ Processing ${batches.length} batches with concurrency ${CONCURRENCY}...`);

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    
    await Promise.all(chunk.map(async (batch, idx) => {
      const { error } = await supabaseAdmin
        .from('company_profile')
        .upsert(batch, { onConflict: 'ticker' }); // Allow updates!

      if (error) {
        console.error(`❌ Upsert error in batch group ${i}:`, error);
      } else {
        upserted += batch.length;
      }
    }));
    
    // Optional: Log progress every few chunks
    if ((i + CONCURRENCY) % 20 === 0) {
        console.log(`   Progress: ${Math.min(i + CONCURRENCY, batches.length)}/${batches.length} batches...`);
    }
  }

  console.log(`✅ Company Profile Update Complete. Processed: ${processed}, Upserted: ${upserted}`);
  return { success: true, processed, upserted };
}
