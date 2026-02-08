// Fintra/app/api/cron/fmp-bulk/buildSnapshots.ts

import { normalizeValuation } from "./normalizeValuation";
import { normalizePerformance } from "./normalizePerformance";
import { calculateFGOSFromData } from "@/lib/engine/fintra-brain";
import { calculateMarketPosition } from "@/lib/engine/market-position";
import { normalizeProfileStructural } from "./normalizeProfileStructural";
import { resolveInvestmentVerdict } from "@/lib/engine/resolveInvestmentVerdict";
import { rollingFYGrowth } from "@/lib/utils/rollingGrowth";
import { getBenchmarksForSector } from "@/lib/engine/benchmarks";
import { buildValuationState } from "@/lib/engine/resolveValuationFromSector";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculateFundamentalsGrowth } from "@/lib/engine/fundamentals-growth";
import { resolveValuationFromSector } from "@/lib/engine/resolveValuationFromSector";
import { buildStructuralCoverage } from "@/lib/engine/structural-coverage";
import type {
  FinancialSnapshot,
  FmpProfile,
  FmpRatios,
  FmpMetrics,
  FmpQuote,
} from "@/lib/engine/types";

// Hydration Imports
import { calculateDividendQuality } from "@/lib/engine/dividend-quality";
import {
  calculateRelativeReturn,
  type RelativeReturnTimeline,
  type RelativeReturnWindow,
} from "@/lib/engine/relative-return";
import { resolveFintraVerdict } from "@/lib/engine/fintra-verdict";
import type {
  SentimentValuationTimeline,
  SentimentSnapshotLabel,
  SentimentValuationSnapshot,
} from "@/lib/engine/sentiment";

import { calculateIFS, type RelativePerformanceInputs } from "@/lib/engine/ifs";
import { calculateFundamentalsMaturity } from "@/lib/engine/fundamentals-maturity";
import {
  getIndustryTemporalMap,
  resolveIndustryProfile,
} from "@/lib/engine/industry-metadata";
import { buildLayerStatus } from "@/lib/engine/layer-status";

export const SNAPSHOT_ENGINE_VERSION = "v3.2-full-hydration";

/**
 * Alpha contract: Explicit allowlist of performance window keys
 *
 * Why explicit instead of regex:
 * - Deterministic (no pattern matching ambiguity)
 * - Resilient to naming changes
 * - Self-documenting (shows exact contract)
 * - Type-safe
 *
 * Maintenance: When adding/removing windows, update both:
 * 1. ALPHA_WINDOWS (window codes)
 * 2. ALPHA_ALLOWED_KEYS (actual snapshot keys)
 */
const ALPHA_WINDOWS = ["1M", "3M", "6M", "1Y", "3Y", "5Y"] as const;

const ALPHA_ALLOWED_KEYS = [
  // Relative vs Sector (6 windows, 2Y excluded)
  "relative_vs_sector_1m",
  "relative_vs_sector_3m",
  "relative_vs_sector_6m",
  "relative_vs_sector_1y",
  // "relative_vs_sector_2y", // ← EXCLUDED per Alpha contract
  "relative_vs_sector_3y",
  "relative_vs_sector_5y",

  // Relative vs Market (6 windows, 2Y excluded)
  "relative_vs_market_1m",
  "relative_vs_market_3m",
  "relative_vs_market_6m",
  "relative_vs_market_1y",
  // "relative_vs_market_2y", // ← EXCLUDED per Alpha contract
  "relative_vs_market_3y",
  "relative_vs_market_5y",

  // Sector ranking (not window-specific, always included)
  "sector_rank",
  "sector_rank_total",
] as const;

/**
 * Check if a key is part of the Alpha contract
 */
function isAlphaAllowedKey(key: string): boolean {
  return ALPHA_ALLOWED_KEYS.includes(key as any);
}

/**
 * Debug flag for Alpha contract logging
 * Set DEBUG_ALPHA=true in environment to enable
 */
const DEBUG_ALPHA = process.env.DEBUG_ALPHA === "true";

/* ================================
   Helpers
================================ */

function pending(reason: string, extra: any = {}) {
  return {
    status: "pending",
    computed: false,
    reason,
    ...extra,
  };
}

function discard(sym: string, reason: string, extra: any = {}) {
  console.warn("📉 TICKER DISCARDED", { sym, reason, ...extra });
  return null;
}

function buildSentimentTimeline(
  rows: any[],
): SentimentValuationTimeline | null {
  if (!rows || rows.length === 0) return null;

  // Helper to find closest row to a target date
  const findClosest = (targetDate: Date) => {
    let closest = null;
    let minDiff = Infinity;
    for (const row of rows) {
      if (!row.valuation_date) continue;
      const d = new Date(row.valuation_date);
      const diff = Math.abs(d.getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = row;
      }
    }
    // Allow max 60 days drift for TTM, maybe more for historical?
    // For now, loose tolerance to catch any available history
    return closest;
  };

  const today = new Date();
  const y1 = new Date(today);
  y1.setFullYear(today.getFullYear() - 1);
  const y3 = new Date(today);
  y3.setFullYear(today.getFullYear() - 3);
  const y5 = new Date(today);
  y5.setFullYear(today.getFullYear() - 5);

  const ttm = findClosest(today);
  const ttm1 = findClosest(y1);
  const ttm3 = findClosest(y3);
  const ttm5 = findClosest(y5);

  // Map row to snapshot
  const mapRow = (r: any): SentimentValuationSnapshot | null => {
    if (!r) return null;
    return {
      pe_ratio: r.pe_ratio,
      ev_ebitda: r.ev_ebitda,
      price_to_fcf: r.price_to_fcf,
      price_to_sales: r.price_to_sales,
    };
  };

  return {
    TTM: mapRow(ttm),
    TTM_1A: mapRow(ttm1),
    TTM_3A: mapRow(ttm3),
    TTM_5A: mapRow(ttm5),
  };
}

function buildRelativeReturnTimeline(
  assetRows: any[],
  benchmarkRows: any[],
): RelativeReturnTimeline | null {
  const windows: RelativeReturnWindow[] = ["1Y", "3Y", "5Y"];
  const timeline: RelativeReturnTimeline = {
    "1Y": null,
    "3Y": null,
    "5Y": null,
  };
  let hasData = false;

  for (const w of windows) {
    const asset = assetRows.find((r) => r.window_code === w);
    const bench = benchmarkRows.find((r) => r.window_code === w);

    if (asset && bench) {
      timeline[w] = {
        asset_return: asset.return_percent,
        benchmark_return: bench.return_percent,
        asset_max_drawdown: asset.max_drawdown,
        benchmark_max_drawdown: bench.max_drawdown,
      };
      hasData = true;
    }
  }

  return hasData ? timeline : null;
}

/* ================================
   IFS LOGIC (DEPRECATED - REMOVED)
================================ */
// Logic moved to @/lib/engine/ifs.ts

/* ================================
   SNAPSHOT BUILDER
================================ */

export async function buildSnapshot(
  sym: string,
  profile: FmpProfile | null,
  ratios: FmpRatios | null,
  metrics: FmpMetrics | null,
  quote: FmpQuote | null,
  _priceChange: any,
  scores: any,
  incomeGrowthRows: any[] = [],
  cashflowGrowthRows: any[] = [],
  financialHistory: any[] = [],
  performanceRows: any[] = [],
  valuationRows: any[] = [],
  benchmarkRows: any[] = [],
  allSectorPerformance: Map<string, any[]> = new Map(),
  allIndustryPerformance: Map<string, Map<string, any>> = new Map(),
  universeMap: Map<
    string,
    { sector: string | null; industry: string | null }
  > = new Map(),
): Promise<FinancialSnapshot> {
  console.log("🧪 SNAPSHOT START", sym);

  // 🔍 DEBUG: Log missing components explicitly
  const missingItems: string[] = [];
  if (!profile) missingItems.push("Profile");
  if (!ratios || Object.keys(ratios).length === 0) missingItems.push("Ratios");
  if (!metrics || Object.keys(metrics).length === 0)
    missingItems.push("Metrics");
  if (!scores || Object.keys(scores).length === 0) missingItems.push("Scores");
  if (incomeGrowthRows.length === 0) missingItems.push("IncomeGrowth");
  if (cashflowGrowthRows.length === 0) missingItems.push("CashflowGrowth");

  if (missingItems.length > 0) {
    console.warn(`⚠️ MISSING DATA [${sym}]: ${missingItems.join(", ")}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  /* --------------------------------
     CLASIFICACIÓN (READ-ONLY)
  -------------------------------- */
  let sector: string | null = null;
  let industry: string | null = null;
  let classificationStatus: "full" | "partial" | "missing" = "missing";
  let sectorSource: "canonical" | "profile_fallback" | undefined;

  // FASE 1 OPTIMIZATION: Use prefetched universe map instead of individual query
  const universeRow = universeMap.get(sym);

  if (universeRow && universeRow.sector) {
    sector = universeRow.sector;
    industry = universeRow.industry || null;
    sectorSource = "canonical";
    classificationStatus = "full";
  }
  // 2. FALLBACK (company_profile)
  else if (profile && profile.sector) {
    sector = profile.sector;
    industry = profile.industry || null;
    sectorSource = "profile_fallback";
    classificationStatus = "full";
  } else {
    classificationStatus = "partial";
  }

  if (!sector) {
    console.warn("⚠️ SECTOR MISSING", sym);
  }

  /* --------------------------------
     SECTOR PERFORMANCE (READ-ONLY)
  -------------------------------- */
  const SECTOR_WINDOW_CODES = [
    "1D",
    "1W",
    "1M",
    "3M",
    "6M",
    "YTD",
    "1Y",
    "3Y",
    "5Y",
  ] as const;
  type SectorWindowCode = (typeof SECTOR_WINDOW_CODES)[number];

  let sectorPerformanceStatus: "full" | "partial" | "missing" = "missing";
  const sectorPerformanceData: { [K in SectorWindowCode]?: number | null } = {};

  if (sector) {
    // Optimization: Use pre-fetched sector performance map (which now uses latest available date)
    const sectorRows = allSectorPerformance.get(sector);

    if (sectorRows && sectorRows.length > 0) {
      let presentCount = 0;

      for (const row of sectorRows) {
        const rawCode = row.window_code as string | null;
        if (!rawCode) continue;
        const code = SECTOR_WINDOW_CODES.find((c) => c === rawCode) as
          | SectorWindowCode
          | undefined;
        if (!code) continue;

        sectorPerformanceData[code] =
          typeof row.return_percent === "number"
            ? row.return_percent
            : (row.return_percent ?? null);
        presentCount += 1;
      }

      if (presentCount === 0) {
        sectorPerformanceStatus = "missing";
      } else if (presentCount === SECTOR_WINDOW_CODES.length) {
        sectorPerformanceStatus = "full";
      } else {
        sectorPerformanceStatus = "partial";
      }
    }
  }

  /* --------------------------------
     SECTOR PE (READ-ONLY)
  -------------------------------- */
  let sectorPeStatus: "full" | "partial" | "missing" = "missing";
  let sectorPeValue: number | null = null;

  if (sector) {
    try {
      const { data: peRows } = await supabaseAdmin
        .from("sector_pe")
        .select("pe_date, pe")
        .eq("sector", sector)
        .lte("pe_date", today)
        .order("pe_date", { ascending: false })
        .limit(1);

      if (peRows && peRows.length > 0) {
        const row = peRows[0] as any;
        const rowDate = row.pe_date as string | null;
        const rawPe = row.pe as number | string | null | undefined;

        if (typeof rawPe === "number") {
          sectorPeValue = Number.isFinite(rawPe) ? rawPe : null;
        } else if (typeof rawPe === "string") {
          const parsed = parseFloat(rawPe);
          sectorPeValue = Number.isFinite(parsed) ? parsed : null;
        } else {
          sectorPeValue = null;
        }

        if (rowDate === today) {
          sectorPeStatus = "full";
        } else {
          sectorPeStatus = "partial";
        }
      }
    } catch {
      sectorPeStatus = "partial";
    }
  }

  /* --------------------------------
     INDUSTRY PERFORMANCE (READ-ONLY)
  -------------------------------- */
  const INDUSTRY_WINDOW_CODES = [
    "1D",
    "1W",
    "1M",
    "YTD",
    "1Y",
    "3Y",
    "5Y",
  ] as const;
  type IndustryWindowCode = (typeof INDUSTRY_WINDOW_CODES)[number];

  let industryPerformanceStatus: "full" | "partial" | "missing" = "missing";
  const industryPerformanceData: { [K in IndustryWindowCode]?: number | null } =
    {};

  // FASE 1 OPTIMIZATION: Use prefetched industry performance map instead of 7 queries per ticker
  if (industry) {
    const industryWindowMap = allIndustryPerformance.get(industry);

    if (industryWindowMap) {
      let presentCount = 0;
      let allUsedAreToday = true;

      for (const code of INDUSTRY_WINDOW_CODES) {
        const data = industryWindowMap.get(code);

        if (data) {
          industryPerformanceData[code] =
            typeof data.return_percent === "number"
              ? data.return_percent
              : (data.return_percent ?? null);
          presentCount += 1;

          if (data.performance_date !== today) {
            allUsedAreToday = false;
          }
        } else {
          allUsedAreToday = false;
        }
      }

      if (presentCount === 0) {
        industryPerformanceStatus = "missing";
      } else if (
        presentCount === INDUSTRY_WINDOW_CODES.length &&
        allUsedAreToday
      ) {
        industryPerformanceStatus = "full";
      } else {
        industryPerformanceStatus = "partial";
      }
    } else {
      industryPerformanceStatus = "missing";
    }
  }

  /* --------------------------------
     PROFILE STRUCTURAL (TOLERANTE)
  -------------------------------- */
  const profileStructural = profile
    ? normalizeProfileStructural(profile, ratios, scores)
    : pending("Profile not available in bulk");

  /* --------------------------------
     IFS (READ-ONLY) - REMOVED
  -------------------------------- */
  // Old logic removed. New logic is below relative performance calculation.

  /* --------------------------------
     PERFORMANCE (TOLERANTE)
  -------------------------------- */
  const performance = normalizePerformance(
    profile,
    quote,
    null,
    metrics,
    ratios,
  );

  /* --------------------------------
     CONTEXT: INDUSTRY & MATURITY
  -------------------------------- */
  const industryMap = await getIndustryTemporalMap();
  const industryProfile = resolveIndustryProfile(industry, industryMap);
  const interpretationContext = {
    industry_cadence: industryProfile.cadence,
    structural_horizon_min_years: industryProfile.structural_horizon_min_years,
    dominant_horizons_used: industryProfile.dominant_horizons,
  };

  const maturityResult = calculateFundamentalsMaturity(financialHistory || []);

  /* --------------------------------
     GROWTH REAL (BULK)
  -------------------------------- */
  const fundamentalsGrowth = calculateFundamentalsGrowth(
    incomeGrowthRows,
    cashflowGrowthRows,
    {
      fgos_maturity: maturityResult.fgos_maturity,
      interpretation_context: interpretationContext,
    },
  );

  /* --------------------------------
     FGOS (NUNCA DESCARTA SNAPSHOT)
  -------------------------------- */
  // Prepare Confidence Inputs
  let years_since_ipo = 10;
  if (profile?.ipoDate) {
    const ipo = new Date(profile.ipoDate);
    const now = new Date();
    if (!isNaN(ipo.getTime())) {
      years_since_ipo =
        (now.getTime() - ipo.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    }
  }

  const financial_history_years =
    incomeGrowthRows.length > 0 ? incomeGrowthRows.length + 1 : 0;

  let earnings_volatility_class: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
  if (incomeGrowthRows.length >= 2) {
    const growthRates = incomeGrowthRows
      .map((r) => r.growthRevenue)
      .filter((g: any) => typeof g === "number");
    if (growthRates.length >= 2) {
      const mean =
        growthRates.reduce((a: number, b: number) => a + b, 0) /
        growthRates.length;
      const variance =
        growthRates.reduce(
          (a: number, b: number) => a + Math.pow(b - mean, 2),
          0,
        ) / growthRates.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev < 0.15) earnings_volatility_class = "LOW";
      else if (stdDev > 0.4) earnings_volatility_class = "HIGH";
    }
  }

  const confidenceInputs = {
    financial_history_years,
    years_since_ipo,
    earnings_volatility_class,
  };

  // Build Sentiment Timeline for FGOS (and Verdict)
  const sentimentTimeline = buildSentimentTimeline(valuationRows);

  let fgos = null;
  if (sector) {
    try {
      fgos = await calculateFGOSFromData(
        sym,
        profile ?? {},
        ratios ?? {},
        metrics ?? {},
        fundamentalsGrowth,
        confidenceInputs,
        quote ?? {},
        financialHistory.length > 0 ? financialHistory : null, // Moat
        sentimentTimeline, // Sentiment
        today,
      );
    } catch (error: any) {
      console.error(`[${sym}] FGOS CALCULATION FAILED:`, error.message);
      // Continue with snapshot creation - DO NOT throw
      fgos = null;
    }
  }

  const fgosStatus =
    fgos && typeof fgos.fgos_score === "number" ? "computed" : "pending";

  /* --------------------------------
     VALUATION (MATURITY-AWARE)
  -------------------------------- */
  let valuation = normalizeValuation(ratios, profile);
  let valuationResult: any = null; // Store canonical result for coverage

  if (valuation && sector) {
    const sectorBenchmarks = await getBenchmarksForSector(sector, today);
    if (sectorBenchmarks) {
      // Use NEW buildValuationState logic (Canonical)
      const state = buildValuationState(
        {
          sector: sector,
          pe_ratio: valuation.pe_ratio,
          ev_ebitda: valuation.ev_ebitda,
          price_to_fcf: valuation.price_to_fcf,
        },
        sectorBenchmarks as any,
        {
          fgos_maturity: maturityResult.fgos_maturity,
          interpretation_context: interpretationContext,
        },
      );

      valuationResult = state;

      // Map Canonical Status to Legacy Status for backward compatibility
      let legacyStatus: "undervalued" | "overvalued" | "fair" | "pending" =
        "pending";
      const s = state.valuation_status;
      if (
        s === "very_cheap_sector" ||
        s === "cheap_sector" ||
        s === "potentially_cheap"
      ) {
        legacyStatus = "undervalued";
      } else if (
        s === "expensive_sector" ||
        s === "very_expensive_sector" ||
        s === "potentially_expensive"
      ) {
        legacyStatus = "overvalued";
      } else if (s === "fair_sector") {
        legacyStatus = "fair";
      }

      valuation = {
        ...valuation, // Keep price_to_sales, market_cap, etc.
        stage: state.stage,
        valuation_status: legacyStatus,
        canonical_status: state.valuation_status,
        confidence: state.confidence,
        explanation: state.explanation,
      };
    }
  }

  /* --------------------------------
     STRUCTURAL COVERAGE
  -------------------------------- */
  // Count valid valuation metrics
  let validValuationMetrics = 0;
  if (valuation) {
    if (typeof valuation.pe_ratio === "number") validValuationMetrics++;
    if (typeof valuation.ev_ebitda === "number") validValuationMetrics++;
    if (typeof valuation.price_to_fcf === "number") validValuationMetrics++;
  }

  const structuralCoverage = buildStructuralCoverage({
    fgos_maturity: maturityResult.fgos_maturity,
    industry_cadence: interpretationContext.industry_cadence,
    valid_windows_count: fundamentalsGrowth.coverage.valid_windows,
    required_windows_count: fundamentalsGrowth.coverage.required_windows,
    valid_metrics_count: validValuationMetrics,
    required_metrics_count: 3, // PE, EV/EBITDA, P/FCF
  });

  /* --------------------------------
     ADDITIONAL ENGINES (Hydration)
  -------------------------------- */

  // 1. Dividend Quality
  const dividendQuality = calculateDividendQuality([]);

  // 2. Relative Return
  const relativeReturnTimeline = buildRelativeReturnTimeline(
    performanceRows,
    benchmarkRows,
  );
  const relativeReturn = calculateRelativeReturn(relativeReturnTimeline);

  // 3. Fintra Verdict
  const verdictInputs = {
    fgos: {
      score: fgos?.fgos_score ?? null,
      band:
        fgos?.fgos_category === "High"
          ? "strong"
          : fgos?.fgos_category === "Medium"
            ? "defendable"
            : fgos?.fgos_category === "Low"
              ? "weak"
              : null,
      confidence: fgos?.confidence ?? null,
    },
    competitive_advantage: fgos?.fgos_breakdown?.competitive_advantage
      ? {
          score: fgos.fgos_breakdown.competitive_advantage.score,
          band: fgos.fgos_breakdown.competitive_advantage.band,
          confidence: fgos.fgos_breakdown.competitive_advantage.confidence,
        }
      : undefined,
    sentiment: fgos?.fgos_breakdown?.sentiment_details
      ? {
          score: fgos.fgos_breakdown.sentiment_details.value,
          band: fgos.fgos_breakdown.sentiment_details.band ?? null,
          confidence: fgos.fgos_breakdown.sentiment_details.confidence,
        }
      : undefined,
    dividend_quality: {
      score: dividendQuality.score,
      band: dividendQuality.band,
      confidence: dividendQuality.confidence,
    },
    relative_return: {
      score: relativeReturn.score,
      band: relativeReturn.band,
      confidence: relativeReturn.confidence,
    },
  };

  const fintraVerdict = resolveFintraVerdict(verdictInputs as any);

  /* --------------------------------
     MARKET POSITION
  -------------------------------- */
  const marketPosition = await calculateMarketPosition(
    sym,
    sector,
    {
      marketCap: profile?.mktCap,
      roic: metrics?.roicTTM,
      operatingMargin: ratios?.operatingProfitMarginTTM,
      revenueGrowth: fundamentalsGrowth.revenue_cagr,
    },
    today,
  );

  /* --------------------------------
     INDUSTRY TEMPORAL METADATA (CONTEXT)
  -------------------------------- */
  // Context already resolved at the top of the function

  /* --------------------------------
     RELATIVE PERFORMANCE (Explicit Columns + IFS Inputs)
  -------------------------------- */
  const relPerf: any = {};
  const ifsInputsMap: any = {};

  // Updated windows based on new requirement (v1.2)
  // DB now supports 3M, 6M, 2Y (internal calculations)
  // NOTE: 2Y is computed internally but excluded from snapshots per Alpha contract
  const dbWindows = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y"];
  const allWindows = ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y"]; // Removed 1W, YTD

  // Retrieve sector rows using the resolved sector
  const sectorRows = sector ? allSectorPerformance.get(sector) || [] : [];

  for (const w of allWindows) {
    const stockRow = performanceRows.find((r) => r.window_code === w);
    const marketRow = benchmarkRows.find((r) => r.window_code === w); // SPY
    const sectorRow = sectorRows.find((r) => r.window_code === w);

    const stockRet = stockRow?.return_percent;
    const marketRet = marketRow?.return_percent;
    const sectorRet = sectorRow?.return_percent;

    const keySuffix = w.toLowerCase();

    // Vs Market (Only for DB windows usually, but let's calculate for all just in case, but filter for persistence)
    let vsMarket = null;
    if (typeof stockRet === "number" && typeof marketRet === "number") {
      vsMarket = stockRet - marketRet;
    }

    // Vs Sector
    let vsSector = null;
    if (typeof stockRet === "number" && typeof sectorRet === "number") {
      vsSector = stockRet - sectorRet;
    }

    // Store in IFS Map
    ifsInputsMap[`relative_vs_sector_${keySuffix}`] = vsSector;

    // Store in RelPerf ONLY if it's a DB window
    if (dbWindows.includes(w)) {
      relPerf[`relative_vs_market_${keySuffix}`] = vsMarket;
      relPerf[`relative_vs_sector_${keySuffix}`] = vsSector;
    }
  }

  /* --------------------------------
     IFS (MAJORITY VOTING)
  -------------------------------- */
  const ifsInputs: RelativePerformanceInputs = {
    // Core Windows
    relative_vs_sector_1m: ifsInputsMap.relative_vs_sector_1m ?? null,
    relative_vs_sector_3m: ifsInputsMap.relative_vs_sector_3m ?? null,
    relative_vs_sector_6m: ifsInputsMap.relative_vs_sector_6m ?? null,
    relative_vs_sector_1y: ifsInputsMap.relative_vs_sector_1y ?? null,
    relative_vs_sector_2y: ifsInputsMap.relative_vs_sector_2y ?? null,
    relative_vs_sector_3y: ifsInputsMap.relative_vs_sector_3y ?? null,
    relative_vs_sector_5y: ifsInputsMap.relative_vs_sector_5y ?? null,
  };

  const ifs = calculateIFS(
    ifsInputs,
    interpretationContext.dominant_horizons_used,
  );

  /* --------------------------------
     IQS - Industry Quality Score (PHASE 7b)
     STRUCTURAL metric (separate from IFS Live)
  -------------------------------- */
  let ifs_fy: import("@/lib/engine/types").IQSResult | null = null;

  if (industry) {
    try {
      const { calculateIFS_FY } = await import("@/lib/engine/ifs-fy");
      ifs_fy = await calculateIFS_FY(sym, industry);

      if (ifs_fy) {
        console.log(
          `  ✅ IQS: FY ${ifs_fy.current_fy.fiscal_year} - ${ifs_fy.current_fy.position} (${ifs_fy.fiscal_years.length} FY, confidence: ${ifs_fy.confidence}%)`,
        );
      } else {
        console.log(`  ⚠️  IQS: Insufficient FY data or peer group`);
      }
    } catch (error) {
      console.error(`  ❌ IQS calculation failed:`, error);
      ifs_fy = null;
    }
  } else {
    console.log(`  ⚠️  IQS: Missing industry classification`);
  }

  /* --------------------------------
     LAYER STATUS (PHASE 8)
  -------------------------------- */
  let ifsMissingHorizonsCount = 0;
  for (const horizon of interpretationContext.dominant_horizons_used) {
    const key =
      `relative_vs_sector_${horizon.toLowerCase()}` as keyof RelativePerformanceInputs;
    if (ifsInputs[key] === null) {
      ifsMissingHorizonsCount++;
    }
  }

  const layerStatus = buildLayerStatus({
    fgos_maturity: maturityResult.fgos_maturity,
    ifs_result: ifs,
    missing_horizons_count: ifsMissingHorizonsCount,
    industry_cadence: interpretationContext.industry_cadence,
    growth_result: fundamentalsGrowth,
    valuation_result: valuation ?? null,
    sector_available: !!sector,
    industry_performance_status: industryPerformanceStatus,
  });

  /* --------------------------------
     FUNDAMENTALS MATURITY
  -------------------------------- */
  // Already calculated (Line 386)

  /* --------------------------------
     SNAPSHOT FINAL
  -------------------------------- */

  // Filter performance_windows to exclude 2Y per Alpha contract
  // Uses explicit allowlist instead of regex for determinism
  const snapshotPerformanceWindows = Object.fromEntries(
    Object.entries(relPerf).filter(([key]) => isAlphaAllowedKey(key)),
  );

  // Debug logging (enable with DEBUG_ALPHA=true)
  if (DEBUG_ALPHA) {
    const allKeys = Object.keys(relPerf);
    const keptKeys = Object.keys(snapshotPerformanceWindows);
    const excludedKeys = allKeys.filter((k) => !keptKeys.includes(k));

    console.log(`[ALPHA] ${sym} - Total keys: ${allKeys.length}`);
    console.log(`[ALPHA] ${sym} - Kept keys: ${keptKeys.length}`);
    console.log(`[ALPHA] ${sym} - Excluded: ${excludedKeys.join(", ")}`);
    console.log(
      `[ALPHA] ${sym} - 2Y correctly excluded:`,
      excludedKeys.includes("relative_vs_sector_2y") &&
        excludedKeys.includes("relative_vs_market_2y"),
    );
  }

  return {
    ticker: sym,
    snapshot_date: today,
    engine_version: SNAPSHOT_ENGINE_VERSION,

    // 🔴 Persistencia explícita
    sector,
    classification: {
      status: classificationStatus,
      sector,
      industry,
      source: sectorSource,
    },

    // Spread Relative Performance Fields (2Y excluded)
    ...snapshotPerformanceWindows,

    sector_performance: {
      status: sectorPerformanceStatus,
      data: sectorPerformanceData,
    },

    industry_performance: {
      status: industryPerformanceStatus,
      data: industryPerformanceData,
    },

    sector_pe: {
      status: sectorPeStatus,
      value: sectorPeValue,
    },

    profile_structural: profileStructural,
    market_snapshot: performance ?? null,
    fundamentals_growth: fundamentalsGrowth,

    fgos_score: fgos?.fgos_score ?? null,
    fgos_components: fgos?.fgos_breakdown ?? null,
    fgos_status: fgosStatus,
    fgos_category: fgos?.fgos_category ?? null,
    fgos_confidence_percent: fgos?.confidence ?? null,
    fgos_confidence_label: fgos?.confidence_label ?? null,
    fgos_maturity: maturityResult.fgos_maturity,

    valuation: valuation ?? {
      pe_ratio: null,
      ev_ebitda: null,
      price_to_fcf: null,
      valuation_status: "pending",
      stage: "pending",
      confidence: {
        label: "Low",
        percent: 0,
        valid_metrics_count: 0,
      },
      explanation: "Insufficient data to determine valuation status.",
    },
    market_position: marketPosition,

    // Legacy Investment Verdict (Optional: keep or replace with Fintra Verdict?)
    // Using Fintra Verdict for now as it's the requested hydration
    investment_verdict: fintraVerdict,
    ifs: ifs,
    ifs_fy: ifs_fy, // NEW: Industry Quality Score
    strategic_state: fintraVerdict, // Persist into strategic_state as requested

    relative_return: relativeReturn,

    data_confidence: {
      ...structuralCoverage,
      layer_status: layerStatus,
      // Legacy compatibility flags
      has_profile: !!profile,
      has_financials: !!ratios || !!metrics,
      has_valuation: !!valuation,
      has_performance: !!performance,
      has_fgos: fgosStatus === "computed",
      interpretation_context: interpretationContext,
      fundamentals_years_count: maturityResult.fundamentals_years_count,
      fundamentals_first_year: maturityResult.fundamentals_first_year,
      fundamentals_last_year: maturityResult.fundamentals_last_year,
    },
  };
}
