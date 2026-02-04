import { supabaseAdmin } from "@/lib/supabase-admin";
import { fmpGet } from "@/lib/fmp/server";

const CRON_NAME = "industry-classification-sync";

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

// NOTE:
// industry_classification and asset_industry_map are STRUCTURAL tables.
// Confidence scores must NEVER be persisted here.
// These tables define the classification taxonomy and mappings only.

type IndustryRow = {
  industry_id: string;
  sic_code: string | null;
  sector: string;
  industry: string;
  sub_industry: string | null;
  source: string;
};

type AssetIndustryRow = {
  ticker: string;
  industry_id: string;
  sector: string;
  source: string;
};

function normalizeSicCode(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function buildIndustryId(
  sicCode: string | null,
  sector: string,
  industry: string,
  subIndustry: string | null,
): string {
  const parts = [
    sicCode ? `SIC:${sicCode}` : "SIC:UNKNOWN",
    `SECTOR:${sector.toUpperCase()}`,
    `IND:${industry.toUpperCase()}`,
  ];
  if (subIndustry) {
    parts.push(`SUB:${subIndustry.toUpperCase()}`);
  }
  return parts.join("|");
}

export async function runIndustryClassificationSync() {
  const start = Date.now();
  console.log(`🚀 Starting ${CRON_NAME}...`);

  try {
    // REPLACEMENT STRATEGY:
    // The FMP endpoints for bulk industry classification are now LEGACY and restricted.
    // Instead of failing, we will rebuild the industry map from our own `company_profile` table,
    // which is already populated by `company-profile-bulk`.

    // 1. Fetch all profiles with sector/industry
    const { data: profiles, error } = await supabaseAdmin
      .from("company_profile")
      .select("ticker, sector, industry, description") // description or other fields if needed for future
      .not("sector", "is", null)
      .not("industry", "is", null);

    if (error) {
      console.error(`[${CRON_NAME}] Failed to fetch company_profile:`, error);
      throw error;
    }

    const industryMap = new Map<string, IndustryRow>();
    const assetRows: AssetIndustryRow[] = [];

    if (profiles) {
      for (const p of profiles) {
        const sector = (p.sector || "").trim();
        const industry = (p.industry || "").trim();
        if (!sector || !industry) continue;

        // We don't have SIC codes in company_profile usually, but that's fine.
        // We generate a consistent ID.
        const industryId = buildIndustryId(null, sector, industry, null);

        // 2. Build Industry Row
        if (!industryMap.has(industryId)) {
          industryMap.set(industryId, {
            industry_id: industryId,
            sic_code: null,
            sector,
            industry,
            sub_industry: null,
            source: "internal_profile",
          });
        }

        // 3. Build Asset Mapping
        assetRows.push({
          ticker: p.ticker,
          industry_id: industryId,
          sector,
          source: "internal_profile",
        });
      }
    }

    // (Original FMP fetching logic removed because endpoints are 403 Forbidden)

    const uniqueAssets = new Map<string, AssetIndustryRow>();
    for (const row of assetRows) {
      // Keep first occurrence (all from same source now)
      if (!uniqueAssets.has(row.ticker)) {
        uniqueAssets.set(row.ticker, row);
      }
    }

    const industriesToUpsert = Array.from(industryMap.values());
    const assetToUpsert = Array.from(uniqueAssets.values());

    console.log(
      `[${CRON_NAME}] Prepared ${industriesToUpsert.length} industry rows and ${assetToUpsert.length} asset mappings.`,
    );

    const supabase = supabaseAdmin;

    const upsertChunked = async <T>(
      table: string,
      rows: T[],
      conflict: string,
    ) => {
      const CHUNK = 1000;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from(table)
          .upsert(batch as any, { onConflict: conflict });
        if (error) {
          console.error(
            `[${CRON_NAME}] Upsert error on ${table}:`,
            error.message,
          );
          throw error;
        }
      }
    };

    if (industriesToUpsert.length > 0) {
      await upsertChunked<IndustryRow>(
        "industry_classification",
        industriesToUpsert,
        "industry_id",
      );
    }

    if (assetToUpsert.length > 0) {
      await upsertChunked<AssetIndustryRow>(
        "asset_industry_map",
        assetToUpsert,
        "ticker",
      );
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
