
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

/**
 * REPLACEMENT BACKFILL STRATEGY
 * 
 * Strict Canonical Window Aggregation
 * 
 * Strategy:
 * 1. Find the LATEST available date (snapshot) in industry_performance.
 * 2. Fetch ONLY canonical windows (1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y).
 * 3. Aggregate Equal-Weight Average per Sector per Window.
 * 4. Write to sector_performance (replacing existing for that date).
 * 
 * STRICTLY FORBIDDEN:
 * - 1D, 1W, YTD
 * - Historical iteration (only latest snapshot matters for structural layers)
 */

// Load env vars
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

// Canonical Windows Contract
const CANONICAL_WINDOWS = ['1M', '3M', '6M', '1Y', '2Y', '3Y', '5Y'];

async function main() {
  // Load supabaseAdmin dynamically
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  
  console.log('🚀 Starting Sector Performance Aggregation (Strict Canonical Contract)...');

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

  // 2. Find MAX(performance_date) from industry_performance
  // We want the latest date that actually has data.
  const { data: maxDateData, error: maxDateError } = await supabaseAdmin
    .from('industry_performance')
    .select('performance_date')
    .order('performance_date', { ascending: false })
    .limit(1)
    .single();

  if (maxDateError || !maxDateData) {
      console.error('❌ Failed to determine max performance_date from industry_performance:', maxDateError);
      process.exit(1);
  }

  const targetDate = maxDateData.performance_date;
  console.log(`📅 Target Snapshot Date: ${targetDate}`);

  // 3. Fetch ONLY Canonical Windows for that Date
  const { data: industries, error: fetchError } = await supabaseAdmin
    .from('industry_performance')
    .select('industry, return_percent, window_code')
    .eq('performance_date', targetDate)
    .in('window_code', CANONICAL_WINDOWS);

  if (fetchError) {
      console.error('❌ Failed to fetch industry data:', fetchError);
      process.exit(1);
  }

  if (!industries || industries.length === 0) {
      console.warn(`⚠️ No canonical industry data found for ${targetDate}. Aborting.`);
      return;
  }

  console.log(`✅ Fetched ${industries.length} industry rows for aggregation.`);

  // 4. Aggregate by Sector AND Window
  // Map Key: "SECTOR|WINDOW" -> { sum, count }
  const sectorAgg = new Map<string, { sum: number; count: number }>();

  for (const row of industries) {
      const sector = industryToSector.get(row.industry);
      if (!sector) continue;

      const key = `${sector}|${row.window_code}`;
      const current = sectorAgg.get(key) || { sum: 0, count: 0 };
      
      current.sum += Number(row.return_percent);
      current.count += 1;
      sectorAgg.set(key, current);
  }

  if (sectorAgg.size === 0) {
      console.warn('⚠️ No sectors could be mapped. Aborting.');
      return;
  }

  // 5. Prepare Upsert
  const upsertRows = [];
  for (const [key, stats] of sectorAgg.entries()) {
      const [sector, window_code] = key.split('|');
      const avgReturn = stats.sum / stats.count;

      upsertRows.push({
          sector: sector,
          window_code: window_code,
          performance_date: targetDate,
          return_percent: avgReturn,
          source: 'aggregated_from_industries'
      });
  }

  // 6. Write to DB
  const { error: upsertError } = await supabaseAdmin
      .from('sector_performance')
      .upsert(upsertRows, { onConflict: 'sector, performance_date, window_code' });

  if (upsertError) {
      console.error('❌ Failed to upsert sector performance:', upsertError.message);
  } else {
      console.log(`✅ Successfully upserted ${upsertRows.length} sector performance rows.`);
      
      // Verification Log
      const countsByWindow: Record<string, number> = {};
      upsertRows.forEach(r => {
          countsByWindow[r.window_code] = (countsByWindow[r.window_code] || 0) + 1;
      });
      console.table(countsByWindow);
  }
}

main().catch(console.error);
