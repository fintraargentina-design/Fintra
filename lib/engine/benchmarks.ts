
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SectorBenchmark } from "./types";

// Simple in-memory cache to avoid hammering DB in a loop
// This is useful when processing bulk snapshots for the same sector
const CACHE: Record<string, Record<string, SectorBenchmark>> = {};
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
const CACHE_TIMESTAMP: Record<string, number> = {};

export async function getBenchmarksForSector(sector: string): Promise<Record<string, SectorBenchmark> | null> {
  if (!sector) return null;
  const cleanSector = sector.trim();

  // Check Cache
  const now = Date.now();
  if (CACHE[cleanSector] && CACHE_TIMESTAMP[cleanSector] && (now - CACHE_TIMESTAMP[cleanSector] < CACHE_TTL_MS)) {
    return CACHE[cleanSector];
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('sector_benchmarks')
      .select('*')
      .eq('sector', cleanSector);

    if (error) {
        console.error(`Error fetching benchmarks for ${cleanSector}:`, error);
        return null;
    }

    if (!data || data.length === 0) {
      // Fallback to General if specific sector not found
      if (cleanSector !== 'General') {
          // Prevent infinite loop if General is also missing
          const general = await getBenchmarksForSector('General');
          if (general) {
              // Cache the fallback to avoid repeated failed lookups
              CACHE[cleanSector] = general;
              CACHE_TIMESTAMP[cleanSector] = now;
              return general;
          }
      }
      return null;
    }

    const benchmarks: Record<string, SectorBenchmark> = {};
    for (const row of data) {
      // SAFETY: Skip benchmarks with insufficient sample size
      if ((row.sample_size || 0) < 3) continue;

      // Map DB metric names if they differ from code keys?
      // Assuming DB metric names match code keys (e.g., 'revenue_cagr', 'pe_ratio')
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
    CACHE[cleanSector] = benchmarks;
    CACHE_TIMESTAMP[cleanSector] = now;

    return benchmarks;

  } catch (err) {
    console.error(`Unexpected error fetching benchmarks for ${cleanSector}:`, err);
    return null;
  }
}
