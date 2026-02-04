import 'dotenv/config';
import { supabaseAdmin } from '@/lib/supabase-admin';

type UniverseRow = {
  ticker: string;
  sector: string | null;
  industry: string | null;
  last_profile_update: string | null;
  last_seen: string | null;
};

type AssetIndustryInsert = {
  ticker: string;
  industry_code: string;
  source: string;
  effective_from: string;
  effective_to: string | null;
};

function generateIndustryCode(sector: string, industry: string): string {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${clean(sector)}__${clean(industry)}`;
}

async function main() {
  console.log('🚀 Starting resolve-asset-industry...');

  try {
    const today = new Date().toISOString().slice(0, 10);

    const allUniverseRows: UniverseRow[] = [];
    let fetchMore = true;
    let offset = 0;
    const CHUNK_SIZE = 1000;

    console.log('Fetching fintra_universe...');
    while (fetchMore) {
      const { data, error } = await supabaseAdmin
        .from('fintra_universe')
        .select('ticker, sector, industry, last_profile_update, last_seen')
        .range(offset, offset + CHUNK_SIZE - 1);

      if (error) {
        console.error('Error loading fintra_universe chunk:', error.message);
        throw error;
      }

      if (data && data.length > 0) {
        allUniverseRows.push(...(data as UniverseRow[]));
        offset += CHUNK_SIZE;
        if (offset % 10000 === 0) console.log(`Fetched ${allUniverseRows.length} rows...`);
        if (data.length < CHUNK_SIZE) fetchMore = false;
      } else {
        fetchMore = false;
      }
    }
    console.log(`Total universe rows fetched: ${allUniverseRows.length}`);

    if (allUniverseRows.length === 0) {
      console.log('No universe rows found.');
      return;
    }

    const { data: classificationRows, error: classificationError } = await supabaseAdmin
      .from('industry_classification')
      .select('industry_code, sector, industry_name');

    if (classificationError) {
      console.error('Error loading industry_classification:', classificationError.message);
      throw classificationError;
    }

    // Build lookup map: "SECTOR|INDUSTRY" -> industry_code
    const industryLookup = new Map<string, string>();
    if (classificationRows) {
      for (const row of classificationRows) {
        const s = (row.sector || '').trim().toUpperCase();
        const i = (row.industry_name || '').trim().toUpperCase();
        const code = row.industry_code;
        if (s && i && code) {
          industryLookup.set(`${s}|${i}`, code);
        }
      }
    }

    const { data: existingAssetRows, error: existingError } = await supabaseAdmin
      .from('asset_industry_map')
      .select('ticker, effective_to');

    if (existingError) {
      console.error('Error loading asset_industry_map:', existingError.message);
      throw existingError;
    }

    const activeAssetTickers = new Set<string>();
    for (const row of existingAssetRows || []) {
      const t = String((row as any).ticker || '').toUpperCase();
      const effectiveTo = (row as any).effective_to as string | null;
      if (!t) continue;
      if (effectiveTo === null) {
        activeAssetTickers.add(t);
      }
    }

    const inserts: AssetIndustryInsert[] = [];

    for (const row of allUniverseRows) {
      const ticker = (row.ticker || '').toUpperCase();
      if (!ticker) continue;
      if (activeAssetTickers.has(ticker)) continue;

      const sector = row.sector?.trim() || null;
      const industry = row.industry?.trim() || null;
      if (!sector || !industry) continue;

      // Lookup existing industry code
      const key = `${sector.toUpperCase()}|${industry.toUpperCase()}`;
      const foundCode = industryLookup.get(key);
      
      if (!foundCode) {
        // console.warn(`Warning: No mapping found for [${sector} | ${industry}] (Ticker: ${ticker})`);
        continue;
      }

      const effectiveFromRaw = row.last_profile_update || row.last_seen || today;
      const effectiveFrom = effectiveFromRaw.slice(0, 10);

      inserts.push({
        ticker,
        industry_code: foundCode,
        source: 'sic_resolve',
        effective_from: effectiveFrom,
        effective_to: null,
      });
    }

    console.log(
      `Prepared asset_industry_map rows: total_universe=${allUniverseRows.length}, to_insert=${inserts.length}, existing_active=${activeAssetTickers.size}`,
    );

    if (inserts.length > 0) {
      const BATCH_SIZE = 1000;
      for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
        const batch = inserts.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin.from('asset_industry_map').insert(batch);
        if (error) {
          console.error('Error inserting asset_industry_map batch:', error.message);
          throw error;
        }
        console.log(`Inserted batch ${i / BATCH_SIZE + 1}: rows=${batch.length}`);
      }
    }

    console.log('Done.');
  } catch (error) {
    console.error('Fatal error in resolve-asset-industry:', error);
    process.exit(1);
  }
}

main();

