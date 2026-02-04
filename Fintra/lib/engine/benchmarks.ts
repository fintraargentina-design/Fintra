
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SectorBenchmark } from "./types";

// Mandatory metrics that MUST be present for FGOS
export const BENCHMARK_METRICS = [
  // Growth (Source: Snapshot/Fundamentals)
  'revenue_cagr', 
  'earnings_cagr', 
  'fcf_cagr',
  
  // Profitability (Source: Financials)
  'roic', 
  'operating_margin', 
  'net_margin',
  
  // Efficiency (Source: Financials)
  'fcf_margin', 
  // 'roic' is also used here but already listed
  
  // Solvency (Source: Financials)
  'debt_to_equity', 
  'interest_coverage',
  
  // Valuation (Source: Snapshot/Valuation)
  'pe_ratio', 
  'ev_ebitda', 
  'price_to_fcf'
] as const;

export type BenchmarkMetric = (typeof BENCHMARK_METRICS)[number];

// Simple in-memory cache to avoid hammering DB in a loop
// This is useful when processing bulk snapshots for the same sector
const CACHE: Record<string, Record<string, SectorBenchmark>> = {};
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const CACHE_TIMESTAMP: Record<string, number> = {};

export async function getBenchmarksForSector(sector: string, snapshotDate: string, allowFallback: boolean = true): Promise<Record<string, SectorBenchmark> | null> {
  if (!sector) return null;
  const cleanSector = sector.trim();
  const cacheKey = `${cleanSector}_${snapshotDate}_${allowFallback}`;

  // Check Cache
  const now = Date.now();
  if (CACHE[cacheKey] && CACHE_TIMESTAMP[cacheKey] && (now - CACHE_TIMESTAMP[cacheKey] < CACHE_TTL_MS)) {
    return CACHE[cacheKey];
  }

  try {
    // 1. Resolve effective AS-OF date
    const { data: dateData, error: dateError } = await supabaseAdmin
      .from('sector_benchmarks')
      .select('snapshot_date')
      .eq('sector', cleanSector)
      .lte('snapshot_date', snapshotDate)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dateError) {
        console.error(`Error resolving benchmark date for ${cleanSector} <= ${snapshotDate}:`, dateError);
        return null;
    }

    if (!dateData) {
      // Fallback to General if specific sector not found (only if allowed)
      if (allowFallback && cleanSector !== 'General') {
          const general = await getBenchmarksForSector('General', snapshotDate, true);
          if (general) {
              CACHE[cacheKey] = general;
              CACHE_TIMESTAMP[cacheKey] = now;
              return general;
          }
      }
      return null;
    }

    const resolvedDate = dateData.snapshot_date;

    // 2. Fetch benchmarks for the resolved date
    const { data, error } = await supabaseAdmin
      .from('sector_benchmarks')
      .select('*')
      .eq('sector', cleanSector)
      .eq('snapshot_date', resolvedDate);

    if (error) {
        console.error(`Error fetching benchmarks for ${cleanSector} on ${resolvedDate}:`, error);
        return null;
    }

    if (!data || data.length === 0) {
      return null; // Should not happen if date resolution succeeded, but safe to handle
    }

    // Optional: Log resolution if it differs (debug purposes, low noise)
    if (resolvedDate !== snapshotDate) {
        // console.log(`[Benchmarks] Resolved ${cleanSector}: requested ${snapshotDate} -> found ${resolvedDate}`);
    }

    const benchmarks: Record<string, SectorBenchmark> = {};
    for (const row of data) {
      // SAFETY: Skip benchmarks with insufficient sample size
      if ((row.sample_size || 0) < 3) continue;

      benchmarks[row.metric] = {
        p10: row.p10,
        p25: row.p25,
        p50: row.p50,
        p75: row.p75,
        p90: row.p90,
        sample_size: row.sample_size,
        confidence: row.confidence as 'low' | 'medium' | 'high',
        median: row.median,
        trimmed_mean: row.trimmed_mean,
        uncertainty_range: row.uncertainty_range
      };
    }

    if (Object.keys(benchmarks).length === 0) {
      return null;
    }

    // Update Cache
    CACHE[cacheKey] = benchmarks;
    CACHE_TIMESTAMP[cacheKey] = now;

    return benchmarks;

  } catch (err) {
    console.error(`Unexpected error fetching benchmarks for ${cleanSector}:`, err);
    return null;
  }
}
