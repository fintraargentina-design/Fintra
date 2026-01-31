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

    const { data: universeRows, error: universeError } = await supabaseAdmin
      .from('fintra_universe')
      .select('ticker, sector, industry, last_profile_update, last_seen');

    if (universeError) {
      console.error('Error loading fintra_universe:', universeError.message);
      throw universeError;
    }

    if (!universeRows || universeRows.length === 0) {
      console.log('No universe rows found.');
      return;
    }

    const { data: classificationRows, error: classificationError } = await supabaseAdmin
      .from('industry_classification')
      .select('industry_code');

    if (classificationError) {
      console.error('Error loading industry_classification:', classificationError.message);
      throw classificationError;
    }

    const knownIndustryCodes = new Set(
      (classificationRows || []).map((r: any) => String((r as any).industry_code)),
    );

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

    for (const row of universeRows as UniverseRow[]) {
      const ticker = (row.ticker || '').toUpperCase();
      if (!ticker) continue;
      if (activeAssetTickers.has(ticker)) continue;

      const sector = row.sector?.trim() || null;
      const industry = row.industry?.trim() || null;
      if (!sector || !industry) continue;

      const industryCode = generateIndustryCode(sector, industry);
      if (!knownIndustryCodes.has(industryCode)) continue;

      const effectiveFromRaw = row.last_profile_update || row.last_seen || today;
      const effectiveFrom = effectiveFromRaw.slice(0, 10);

      inserts.push({
        ticker,
        industry_code: industryCode,
        source: 'sic_resolve',
        effective_from: effectiveFrom,
        effective_to: null,
      });
    }

    console.log(
      `Prepared asset_industry_map rows: total_universe=${universeRows.length}, to_insert=${inserts.length}, existing_active=${activeAssetTickers.size}`,
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

