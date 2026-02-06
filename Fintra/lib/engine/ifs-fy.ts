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
 * - STRICT continuity required (no gaps)
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
 * Returns null if distribution is insufficient
 */
function calculatePercentile(value: number, distribution: number[]): number | null {
  if (distribution.length < 3) return null; // Requirement: peer group size >= 3

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
    .limit(limit + 2); // Fetch a bit more to handle potential duplicates or gaps check

  if (error) {
    console.error(`[IQS] Error fetching FY data for ${ticker}:`, error);
    return [];
  }

  // Filter and map
  const uniqueYears = new Set<string>();
  const validRows: FiscalYearData[] = [];

  for (const row of (data || [])) {
    // 1. Basic Existence Check (Rule 3)
    // We assume if row exists, statements existed. 
    // But we strictly require roic and operating_margin per Rule 3.
    if (row.roic === null || row.operating_margin === null) {
      continue; // Invalid FY
    }

    const year = new Date(row.period_end_date).getFullYear().toString();
    
    // Deduplicate by year
    if (uniqueYears.has(year)) continue;
    uniqueYears.add(year);

    validRows.push({
      ...row,
      fiscal_year: year,
      fiscal_date_ending: row.period_end_date,
    } as FiscalYearData);

    if (validRows.length >= limit) break;
  }

  return validRows;
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

  if (peerTickers.length < 3) { // Rule 3: Peer group size >= 3
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
  // Require minimum fundamental data (Rule 3)
  if (fy.roic === null || fy.operating_margin === null) {
    return null; 
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
  // Rule 6: Percentiles are RELATIVE
  const roic_pct = calculatePercentile(fy.roic, distributions.roic_values);
  const margin_pct = calculatePercentile(
    fy.operating_margin,
    distributions.margin_values,
  );

  // If core metrics fail to rank (e.g. insufficient peers), abort
  if (roic_pct === null || margin_pct === null) return null;

  // Growth (Rule 4: exclude if missing, do not default)
  const growth_pct =
    fy.revenue_cagr !== null 
      ? calculatePercentile(fy.revenue_cagr, distributions.growth_values)
      : null;

  // Leverage (invert: lower is better)
  let leverage_pct: number | null = null;
  if (fy.debt_to_equity !== null) {
     const raw = calculatePercentile(fy.debt_to_equity, distributions.leverage_values);
     if (raw !== null) leverage_pct = 100 - raw;
  }

  // FCF (optional)
  const fcf_pct =
    fy.fcf_margin !== null
      ? calculatePercentile(fy.fcf_margin, distributions.fcf_values)
      : null;

  // Weighted composite percentile with Dynamic Weighting
  // Base Weights:
  // ROIC: 30
  // Margin: 25
  // Growth: 20
  // Leverage: 15
  // FCF: 10
  // Total: 100

  let numerator = 0;
  let denominator = 0;

  // ROIC (Mandatory)
  numerator += roic_pct * 30;
  denominator += 30;

  // Margin (Mandatory)
  numerator += margin_pct * 25;
  denominator += 25;

  // Growth
  if (growth_pct !== null) {
    numerator += growth_pct * 20;
    denominator += 20;
  }

  // Leverage
  if (leverage_pct !== null) {
    numerator += leverage_pct * 15;
    denominator += 15;
  }

  // FCF
  if (fcf_pct !== null) {
    numerator += fcf_pct * 10;
    denominator += 10;
  }

  if (denominator === 0) return null; // Should not happen given mandatory checks

  return numerator / denominator;
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
  // 1. Fetch recent fiscal years (fetch extra to handle potential gaps/invalid years)
  // Rule 1: Only FY data. getFiscalYearData handles this.
  const rawFyData = await getFiscalYearData(ticker, 8);

  if (rawFyData.length < 3) {
    return null; // Rule 5: Minimum 3 consecutive FYs
  }

  // 2. Find the most recent VALID sequence of at least 3 consecutive years
  // rawFyData is sorted descending (Newest -> Oldest)
  
  let bestSequence: IQSFiscalYearPosition[] = [];
  let currentSequence: IQSFiscalYearPosition[] = [];
  
  // We need to check validity (Peers/Metrics) for each candidate year
  // This might be expensive, so we process one by one
  
  for (let i = 0; i < rawFyData.length; i++) {
    const fy = rawFyData[i];
    
    // Check Date Continuity with previous year in current sequence
    if (currentSequence.length > 0) {
      const prevYear = parseInt(currentSequence[currentSequence.length - 1].fiscal_year);
      const thisYear = parseInt(fy.fiscal_year);
      
      if (prevYear - thisYear !== 1) {
        // Continuity broken by date gap
        // Check if current sequence is valid candidate
        if (currentSequence.length >= 3) {
          bestSequence = currentSequence; 
          break; // Found a valid sequence (most recent one), stop looking
        }
        // Reset sequence
        currentSequence = [];
      }
    }
    
    // Validate Metric/Peer Suitability
    // Rule 2: Evaluated against INDUSTRY peers for SAME fiscal year
    const percentile = await calculateFYPercentile(fy, industry, ticker);
    
    if (percentile === null) {
      // Invalid year (e.g. low peers, missing growth/margin)
      // Continuity broken by data invalidity
      if (currentSequence.length >= 3) {
        bestSequence = currentSequence;
        break; // Found a valid sequence, stop
      }
      currentSequence = []; // Reset
      continue;
    }
    
    // Valid year -> Add to sequence
    const position = classifyPosition(percentile);
    currentSequence.push({
      fiscal_year: fy.fiscal_year,
      position,
      percentile: Math.round(percentile),
    });
    
    // Optimization: If we have 5 years (max timeline), we can stop
    if (currentSequence.length >= 5) {
      bestSequence = currentSequence;
      break;
    }
  }
  
  // Final check if loop finished without breaking
  if (bestSequence.length === 0 && currentSequence.length >= 3) {
    bestSequence = currentSequence;
  }
  
  if (bestSequence.length < 3) {
    return null; // No valid sequence found
  }

  // 3. Prepare Result
  // bestSequence is sorted Newest -> Oldest. 
  // Output format requires Oldest -> Newest for arrays
  const fiscal_positions = [...bestSequence].reverse();
  const fiscal_years = fiscal_positions.map((fp) => fp.fiscal_year);

  // 4. Calculate confidence (based ONLY on FY count, not trend)
  const confidence = calculateConfidence(fiscal_positions.length);

  // 5. Get current FY (most recent in the sequence)
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
