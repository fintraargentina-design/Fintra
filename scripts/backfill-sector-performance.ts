
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * REPLACEMENT BACKFILL STRATEGY
 * 
 * Original Strategy: Fetch Historical Sector Performance from FMP.
 * Problem: FMP endpoint is Legacy (403 Forbidden) for new/standard keys.
 * 
 * New Strategy: Aggregate Industry Performance.
 * We fetch all rows from `industry_performance` (which works fine),
 * map them to sectors via `industry_classification`,
 * and calculate the Equal-Weight Average return for the sector.
 */

// Load env vars
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const START_DATE = '2025-01-01';

async function main() {
  // Load supabaseAdmin dynamically
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  
  console.log('🚀 Starting Sector Performance Aggregation from Industries (Fallback Strategy)...');

  // 1. Load Industry -> Sector Map
  const { data: mappingData, error: mappingError } = await supabaseAdmin
    .from('industry_classification')
    .select('industry_name, sector');

  if (mappingError || !mappingData) {
    console.error('❌ Failed to load industry classification:', mappingError);
    process.exit(1);
  }

  const industryToSector = new Map<string, string>();
  mappingData.forEach((row) => {
    if (row.industry_name && row.sector) {
      industryToSector.set(row.industry_name, row.sector);
    }
  });

  console.log(`✅ Loaded ${industryToSector.size} industry mappings.`);

  // 2. Determine Date Range
  // We'll iterate from START_DATE to Today
  const start = new Date(START_DATE);
  const end = new Date();
  
  let current = new Date(start);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    // console.log(`📅 Processing ${dateStr}...`); // Reduce noise

    await processDate(dateStr, industryToSector, supabaseAdmin);

    // Next day
    current.setDate(current.getDate() + 1);
  }

  console.log('✅ Aggregation Complete.');
}

async function processDate(date: string, mapping: Map<string, string>, supabaseAdmin: any) {
  // Fetch Industry Performance for this date (1D only)
  const { data: industries, error } = await supabaseAdmin
    .from('industry_performance')
    .select('industry, return_percent')
    .eq('performance_date', date)
    .eq('window_code', '1D');

  if (error) {
    console.error(`   ❌ Error fetching industries for ${date}:`, error.message);
    return;
  }

  if (!industries || industries.length === 0) {
    // console.log(`   ⚠️ No industry data for ${date} (skipping)`);
    return;
  }

  // Aggregate by Sector
  const sectorReturns = new Map<string, { sum: number; count: number }>();

  for (const row of industries) {
    const sector = mapping.get(row.industry);
    if (!sector) continue; // Skip if no sector mapping

    const current = sectorReturns.get(sector) || { sum: 0, count: 0 };
    current.sum += Number(row.return_percent);
    current.count += 1;
    sectorReturns.set(sector, current);
  }

  if (sectorReturns.size === 0) return;

  // Prepare Upsert Data
  const upsertRows = [];
  for (const [sector, stats] of sectorReturns.entries()) {
    const avgReturn = stats.sum / stats.count;
    upsertRows.push({
      sector: sector,
      window_code: '1D',
      performance_date: date,
      return_percent: avgReturn,
      source: 'aggregated_from_industries'
    });
  }

  // Batch Upsert
  const { error: upsertError } = await supabaseAdmin
    .from('sector_performance')
    .upsert(upsertRows, { onConflict: 'sector, performance_date, window_code' });

  if (upsertError) {
    console.error(`   ❌ Failed to upsert sectors for ${date}:`, upsertError.message);
  } else {
    console.log(`   ✅ Saved ${upsertRows.length} sectors for ${date}`);
  }
}

main().catch(console.error);
