/**
 * IQS - Industry Quality Score
 *
 * Calculates STRUCTURAL competitive position using fiscal year fundamentals
 * vs industry peers.
 *
 * This is NOT IFS Live. They coexist but never merge.
 *
 * ARCHITECTURE:
 * - Percentile-based ranking (RELATIVE to industry, not absolute)
 * - No O(N²) peer loops (uses aggregated industry benchmarks)
 * - Explicit fiscal year mapping (no inferred duration)
 * - Deterministic and batch-friendly
 *
 * PRINCIPLES:
 * - Do NOT invent or interpolate missing FY data
 * - Return null if insufficient data (per Fintra standards)
 * - No trend calculation or narrative inference
 * - Max 5 fiscal years (cap)
 * - Industry comparison required (not sector)
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  FiscalYearData,
  IQSResult,
  IQSPosition,
  IQSFiscalYearPosition,
} from "./types";

/**
 * Calculate percentile rank of a value within a distribution
 */
function calculatePercentile(value: number, distribution: number[]): number {
  if (distribution.length === 0) return 50; // Neutral if no peers

  const sorted = [...distribution].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v <= value).length;
  return (rank / sorted.length) * 100;
}

/**
 * Classify position based on percentile (industry-relative)
 */
function classifyPosition(percentile: number): IQSPosition {
  if (percentile >= 75) return "leader"; // Top quartile
  if (percentile >= 35) return "follower"; // Middle
  return "laggard"; // Bottom
}

/**
 * Calculate confidence based ONLY on FY data completeness
 * NOT on trend, consistency, or improvement
 */
function calculateConfidence(fyCount: number): number {
  // More fiscal years = higher confidence
  // 1 FY = 20%, 2 FY = 40%, 3 FY = 60%, 4 FY = 80%, 5 FY = 100%
  return Math.min(100, fyCount * 20);
}

/**
 * Fetch fiscal year data for a ticker
 */
async function getFiscalYearData(
  ticker: string,
  limit: number = 5,
): Promise<FiscalYearData[]> {
  const { data, error } = await supabaseAdmin
    .from("datos_financieros")
    .select(
      `
      period_end_date,
      roic,
      operating_margin,
      net_margin,
      revenue_cagr,
      fcf_margin,
      debt_to_equity,
      current_ratio
    `,
    )
    .eq("ticker", ticker)
    .eq("period_type", "FY")
    .order("period_end_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[IQS] Error fetching FY data for ${ticker}:`, error);
    return [];
  }

  return (data || []).map((row: any) => ({
    ...row,
    fiscal_year: new Date(row.period_end_date).getFullYear().toString(),
    fiscal_date_ending: row.period_end_date,
  })) as unknown as FiscalYearData[];
}

/**
 * Get industry peer fiscal year metrics for benchmarking
 *
 * NOTE: This is a simplified implementation.
 * In production, use precomputed industry_fy_benchmarks table
 * to avoid repeated queries.
 */
async function getIndustryFYMetrics(
  industry: string,
  fiscalYear: string,
  excludeTicker: string,
): Promise<{
  roic_values: number[];
  margin_values: number[];
  growth_values: number[];
  leverage_values: number[];
  fcf_values: number[];
}> {
  // Get all tickers in this industry
  const { data: profiles } = await supabaseAdmin
    .from("fintra_snapshots")
    .select("ticker, profile_structural")
    .not("profile_structural", "is", null)
    .order("snapshot_date", { ascending: false })
    .limit(5000);

  if (!profiles) {
    return {
      roic_values: [],
      margin_values: [],
      growth_values: [],
      leverage_values: [],
      fcf_values: [],
    };
  }

  // Extract tickers with matching industry
  const seenTickers = new Set<string>();
  const peerTickers: string[] = [];

  for (const row of profiles) {
    if (seenTickers.has(row.ticker)) continue;
    if (row.ticker === excludeTicker) continue;

    const profile = row.profile_structural as any;
    const pIndustry = profile?.industry || profile?.classification?.industry;
    
    if (pIndustry === industry) {
      peerTickers.push(row.ticker);
      seenTickers.add(row.ticker);
    }
  }

  if (peerTickers.length === 0) {
    return {
      roic_values: [],
      margin_values: [],
      growth_values: [],
      leverage_values: [],
      fcf_values: [],
    };
  }

  // Fetch FY data for all peers (single query, not O(N²) loops)
  const { data: peerFYData } = await supabaseAdmin
    .from("datos_financieros")
    .select(
      "ticker, roic, operating_margin, revenue_cagr, debt_to_equity, fcf_margin",
    )
    .eq("period_type", "FY")
    .gte("period_end_date", `${fiscalYear}-01-01`)
    .lte("period_end_date", `${fiscalYear}-12-31`)
    .in("ticker", peerTickers);

  if (!peerFYData) {
    return {
      roic_values: [],
      margin_values: [],
      growth_values: [],
      leverage_values: [],
      fcf_values: [],
    };
  }

  // Extract metric distributions
  const result = {
    roic_values: [] as number[],
    margin_values: [] as number[],
    growth_values: [] as number[],
    leverage_values: [] as number[],
    fcf_values: [] as number[],
  };

  for (const row of peerFYData) {
    if (row.roic !== null) result.roic_values.push(row.roic);
    if (row.operating_margin !== null)
      result.margin_values.push(row.operating_margin);
    if (row.revenue_cagr !== null)
      result.growth_values.push(row.revenue_cagr);
    if (row.debt_to_equity !== null)
      result.leverage_values.push(row.debt_to_equity);
    if (row.fcf_margin !== null) result.fcf_values.push(row.fcf_margin);
  }

  return result;
}

/**
 * Calculate composite percentile for a fiscal year
 * Uses RELATIVE industry comparison (not absolute bounds)
 */
async function calculateFYPercentile(
  fy: FiscalYearData,
  industry: string,
  ticker: string,
): Promise<number | null> {
  // Require minimum fundamental data
  if (fy.roic === null || fy.operating_margin === null) {
    return null; // Cannot score without core profitability metrics
  }

  // Get industry peer metrics for this fiscal year
  const distributions = await getIndustryFYMetrics(
    industry,
    fy.fiscal_year,
    ticker,
  );

  if (
    distributions.roic_values.length < 3 ||
    distributions.margin_values.length < 3
  ) {
    // Need minimum peer group for reliable percentile
    return null;
  }

  // Calculate percentile for each metric (industry-relative)
  const roic_pct = calculatePercentile(fy.roic, distributions.roic_values);
  const margin_pct = calculatePercentile(
    fy.operating_margin,
    distributions.margin_values,
  );

  // Growth (optional, use 50th percentile if missing)
  const growth_pct =
    fy.revenue_cagr !== null && distributions.growth_values.length >= 3
      ? calculatePercentile(fy.revenue_cagr, distributions.growth_values)
      : 50;

  // Leverage (invert: lower is better)
  const leverage_pct =
    fy.debt_to_equity !== null && distributions.leverage_values.length >= 3
      ? 100 -
        calculatePercentile(fy.debt_to_equity, distributions.leverage_values)
      : 50;

  // FCF (optional)
  const fcf_pct =
    fy.fcf_margin !== null && distributions.fcf_values.length >= 3
      ? calculatePercentile(fy.fcf_margin, distributions.fcf_values)
      : 50;

  // Weighted composite percentile
  const composite =
    roic_pct * 0.3 + // 30% - Return on capital
    margin_pct * 0.25 + // 25% - Profitability
    growth_pct * 0.2 + // 20% - Growth
    leverage_pct * 0.15 + // 15% - Financial health (inverted)
    fcf_pct * 0.1; // 10% - Cash generation

  return composite;
}

/**
 * Main IQS calculation
 *
 * Returns null if insufficient data (per Fintra principles)
 */
export async function calculateIFS_FY(
  ticker: string,
  industry: string,
): Promise<IQSResult | null> {
  // 1. Fetch last 5 fiscal years
  const fyData = await getFiscalYearData(ticker, 5);

  if (fyData.length === 0) {
    return null; // No FY data available
  }

  // 2. Calculate position for each FY
  const fiscal_positions: IQSFiscalYearPosition[] = [];

  // Process in chronological order (oldest first)
  const fyDataChronological = [...fyData].reverse();

  for (const fy of fyDataChronological) {
    const percentile = await calculateFYPercentile(fy, industry, ticker);

    if (percentile === null) {
      continue; // Skip FY with insufficient data or peer group
    }

    const position = classifyPosition(percentile);

    fiscal_positions.push({
      fiscal_year: fy.fiscal_year,
      position,
      percentile: Math.round(percentile),
    });
  }

  if (fiscal_positions.length === 0) {
    return null; // Could not calculate any FY
  }

  // 3. Extract explicit fiscal year list
  const fiscal_years = fiscal_positions.map((fp) => fp.fiscal_year);

  // 4. Calculate confidence (based ONLY on FY count, not trend)
  const confidence = calculateConfidence(fiscal_positions.length);

  // 5. Get current FY (most recent)
  const current = fiscal_positions[fiscal_positions.length - 1];

  return {
    mode: "fy_industry_structural",
    fiscal_years,
    fiscal_positions,
    current_fy: {
      fiscal_year: current.fiscal_year,
      position: current.position,
    },
    confidence,
  };
}
