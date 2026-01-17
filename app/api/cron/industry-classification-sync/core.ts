import { supabaseAdmin } from '@/lib/supabase-admin';
import { fmpGet } from '@/lib/fmp/server';

const CRON_NAME = 'industry-classification-sync';

type RawIndustryNode = {
  sicCode?: string | number | null;
  sector?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
};

type RawTickerNode = {
  symbol?: string | null;
  sicCode?: string | number | null;
  sector?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
};

type IndustryRow = {
  industry_id: string;
  sic_code: string | null;
  sector: string;
  industry: string;
  sub_industry: string | null;
  confidence: number;
  source: string;
};

type AssetIndustryRow = {
  ticker: string;
  industry_id: string;
  sector: string;
  confidence: number;
  source: string;
};

function normalizeSicCode(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function buildIndustryId(sicCode: string | null, sector: string, industry: string, subIndustry: string | null): string {
  const parts = [
    sicCode ? `SIC:${sicCode}` : 'SIC:UNKNOWN',
    `SECTOR:${sector.toUpperCase()}`,
    `IND:${industry.toUpperCase()}`,
  ];
  if (subIndustry) {
    parts.push(`SUB:${subIndustry.toUpperCase()}`);
  }
  return parts.join('|');
}

export async function runIndustryClassificationSync() {
  const start = Date.now();
  console.log(`🚀 Starting ${CRON_NAME}...`);

  try {
    const [allIndustryList, allClassification, allSicList] = await Promise.all([
      fmpGet<any[]>('/api/v3/all-industry-classification').catch(() => []),
      fmpGet<any[]>('/api/v3/industry-classification-search').catch(() => []),
      fmpGet<any[]>('/api/v3/standard-industrial-classification-list').catch(() => []),
    ]);

    const industryMap = new Map<string, IndustryRow>();
    const assetRows: AssetIndustryRow[] = [];

    const pushIndustry = (node: RawIndustryNode, baseConfidence: number) => {
      const sector = (node.sector || '').toString().trim();
      const industry = (node.industry || '').toString().trim();
      const subIndustryRaw = node.subIndustry || null;
      const subIndustry = subIndustryRaw ? subIndustryRaw.toString().trim() : null;
      if (!sector || !industry) return;

      const sicCode = normalizeSicCode(node.sicCode);
      const industryId = buildIndustryId(sicCode, sector, industry, subIndustry);

      const existing = industryMap.get(industryId);
      if (!existing || existing.confidence < baseConfidence) {
        industryMap.set(industryId, {
          industry_id: industryId,
          sic_code: sicCode,
          sector,
          industry,
          sub_industry: subIndustry,
          confidence: baseConfidence,
          source: 'fmp',
        });
      }
    };

    if (Array.isArray(allIndustryList)) {
      for (const node of allIndustryList) {
        pushIndustry(
          {
            sicCode: (node as any).sicCode ?? (node as any).sic,
            sector: (node as any).sector,
            industry: (node as any).industry,
            subIndustry: (node as any).subIndustry ?? (node as any).sub_industry,
          },
          80,
        );
      }
    }

    if (Array.isArray(allSicList)) {
      for (const node of allSicList) {
        pushIndustry(
          {
            sicCode: (node as any).sicCode ?? (node as any).sic,
            sector: (node as any).sector,
            industry: (node as any).industry,
            subIndustry: (node as any).subIndustry ?? (node as any).sub_industry,
          },
          70,
        );
      }
    }

    const industryArray = Array.from(industryMap.values());

    if (Array.isArray(allClassification)) {
      for (const node of allClassification as RawTickerNode[]) {
        const symbolRaw = node.symbol || (node as any).ticker || null;
        const symbol = symbolRaw ? symbolRaw.toString().trim().toUpperCase() : '';
        if (!symbol) continue;

        const sector = (node.sector || '').toString().trim();
        const industry = (node.industry || '').toString().trim();
        const subIndustryRaw = node.subIndustry ?? (node as any).sub_industry;
        const subIndustry = subIndustryRaw ? subIndustryRaw.toString().trim() : null;
        if (!sector || !industry) continue;

        const sicCode = normalizeSicCode(node.sicCode ?? (node as any).sic);
        const industryId = buildIndustryId(sicCode, sector, industry, subIndustry);

        const base = industryMap.get(industryId) || {
          industry_id: industryId,
          sic_code: sicCode,
          sector,
          industry,
          sub_industry: subIndustry,
          confidence: 60,
          source: 'fmp',
        };
        industryMap.set(industryId, base);

        assetRows.push({
          ticker: symbol,
          industry_id: industryId,
          sector,
          confidence: base.confidence,
          source: 'fmp',
        });
      }
    }

    const uniqueAssets = new Map<string, AssetIndustryRow>();
    for (const row of assetRows) {
      const existing = uniqueAssets.get(row.ticker);
      if (!existing || existing.confidence < row.confidence) {
        uniqueAssets.set(row.ticker, row);
      }
    }

    const industriesToUpsert = Array.from(industryMap.values());
    const assetToUpsert = Array.from(uniqueAssets.values());

    console.log(
      `[${CRON_NAME}] Prepared ${industriesToUpsert.length} industry rows and ${assetToUpsert.length} asset mappings.`,
    );

    const supabase = supabaseAdmin;

    const upsertChunked = async <T>(table: string, rows: T[], conflict: string) => {
      const CHUNK = 1000;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK);
        const { error } = await supabase.from(table).upsert(batch as any, { onConflict: conflict });
        if (error) {
          console.error(`[${CRON_NAME}] Upsert error on ${table}:`, error.message);
          throw error;
        }
      }
    };

    if (industriesToUpsert.length > 0) {
      await upsertChunked<IndustryRow>('industry_classification', industriesToUpsert, 'industry_id');
    }

    if (assetToUpsert.length > 0) {
      await upsertChunked<AssetIndustryRow>('asset_industry_map', assetToUpsert, 'ticker');
    }

    const duration = Date.now() - start;
    console.log(
      `[${CRON_NAME}] Completed. industries=${industriesToUpsert.length}, assets=${assetToUpsert.length}, ms=${duration}`,
    );

    return {
      ok: true,
      industries: industriesToUpsert.length,
      assets: assetToUpsert.length,
      duration_ms: duration,
    };
  } catch (err: any) {
    console.error(`[${CRON_NAME}] Fatal error:`, err?.message || err);
    return { ok: false, error: String(err?.message || err) };
  }
}

