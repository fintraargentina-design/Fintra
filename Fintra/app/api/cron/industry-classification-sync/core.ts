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
  industry_code: string;
  sector: string;
  industry_name: string;
  source: string;
};

type AssetIndustryRow = {
  ticker: string;
  industry_code: string;
  source: string;
  effective_from: string;
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

    // 1. Fetch all profiles with sector/industry (PAGINATED to avoid 1000 row limit)
    const industryMap = new Map<string, IndustryRow>();
    const assetRows: AssetIndustryRow[] = [];

    const PAGE_SIZE = 1000;
    let page = 0;
    let hasMore = true;
    let totalFetched = 0;

    while (hasMore) {
      const { data: profiles, error } = await supabaseAdmin
        .from("company_profile")
        .select("ticker, sector, industry")
        .not("sector", "is", null)
        .not("industry", "is", null)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error(
          `[${CRON_NAME}] Failed to fetch company_profile (page ${page}):`,
          error,
        );
        throw error;
      }

      if (!profiles || profiles.length === 0) {
        hasMore = false;
        break;
      }

      totalFetched += profiles.length;
      console.log(
        `[${CRON_NAME}] Fetched page ${page + 1}: ${profiles.length} profiles (total: ${totalFetched})`,
      );

      if (profiles.length < PAGE_SIZE) {
        hasMore = false;
      }

      // Process this page
      for (const p of profiles) {
        const sector = (p.sector || "").trim();
        const industry = (p.industry || "").trim();
        if (!sector || !industry) continue;

        // We don't have SIC codes in company_profile usually, but that's fine.
        // We generate a consistent ID.
        const industryCode = buildIndustryId(null, sector, industry, null);

        // 2. Build Industry Row
        if (!industryMap.has(industryCode)) {
          industryMap.set(industryCode, {
            industry_code: industryCode,
            sector,
            industry_name: industry,
            source: "internal_profile",
          });
        }

        // 3. Build Asset Mapping
        assetRows.push({
          ticker: p.ticker,
          industry_code: industryCode,
          source: "internal_profile",
          effective_from: "2020-01-01", // Anchor date for current state (SCD Type 1 behavior)
        });
      }

      page++;
    }

    // (Original FMP fetching logic removed because endpoints are 403 Forbidden)

    const uniqueAssets = new Map<string, AssetIndustryRow>();
    for (const row of assetRows) {
      // Keep first occurrence (all from same source now)
      if (!uniqueAssets.has(row.ticker)) {
        uniqueAssets.set(row.ticker, row);
      }
    }

    const industriesToUpsertRaw = Array.from(industryMap.values());

    // Deduplicate by industry_name to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
    // Since industry_name is UNIQUE in DB, we can't have the same industry name in multiple sectors.
    const uniqueIndustriesByName = new Map<string, IndustryRow>();
    for (const row of industriesToUpsertRaw) {
      const key = row.industry_name.trim().toUpperCase();
      if (!uniqueIndustriesByName.has(key)) {
        uniqueIndustriesByName.set(key, row);
      }
    }
    const industriesToUpsert = Array.from(uniqueIndustriesByName.values());

    const assetToUpsert = Array.from(uniqueAssets.values());

    console.log(
      `[${CRON_NAME}] Prepared ${industriesToUpsert.length} industry rows (from ${industriesToUpsertRaw.length} raw) and ${assetToUpsert.length} asset mappings.`,
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
        "industry_name",
      );
    }

    if (assetToUpsert.length > 0) {
      await upsertChunked<AssetIndustryRow>(
        "asset_industry_map",
        assetToUpsert,
        "ticker, effective_from",
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
