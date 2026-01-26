
import { supabaseAdmin } from "@/lib/supabase-admin";

export interface IndustryTemporalProfile {
  cadence: 'fast' | 'medium' | 'slow';
  dominant_horizons: string[];
  structural_horizon_min_years: number;
}

// Default profile used when industry is not found or not mapped
// Using 'Y' standard (1Y, 2Y) instead of 'A' to match codebase conventions
export const DEFAULT_INDUSTRY_PROFILE: IndustryTemporalProfile = {
  cadence: 'medium',
  dominant_horizons: ['6M', '1Y', '2Y', '3Y'],
  structural_horizon_min_years: 3
};

// In-memory cache
let CACHE: Map<string, IndustryTemporalProfile> | null = null;
let CACHE_TIMESTAMP = 0;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * Loads all active industry metadata into an in-memory map.
 * Cached for 1 hour.
 */
export async function getIndustryTemporalMap(): Promise<Map<string, IndustryTemporalProfile>> {
  const now = Date.now();
  if (CACHE && (now - CACHE_TIMESTAMP < CACHE_TTL_MS)) {
    return CACHE;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('industry_metadata')
      .select('industry_code, cadence, dominant_horizons, structural_horizon_min_years');

    if (error) {
      console.error('Failed to load industry metadata:', error);
      // Return empty map on error, consumers will use default
      return new Map();
    }

    const map = new Map<string, IndustryTemporalProfile>();
    if (data) {
      for (const row of data) {
        map.set(row.industry_code, {
          cadence: row.cadence as 'fast' | 'medium' | 'slow',
          dominant_horizons: row.dominant_horizons,
          structural_horizon_min_years: row.structural_horizon_min_years
        });
      }
    }

    CACHE = map;
    CACHE_TIMESTAMP = now;
    return map;
  } catch (err) {
    console.error('Exception loading industry metadata:', err);
    return new Map();
  }
}

/**
 * Resolves the profile for a given industry string.
 * Returns DEFAULT_INDUSTRY_PROFILE if not found.
 */
export function resolveIndustryProfile(
  industry: string | null | undefined, 
  map: Map<string, IndustryTemporalProfile>
): IndustryTemporalProfile {
  if (!industry) return DEFAULT_INDUSTRY_PROFILE;
  return map.get(industry) || DEFAULT_INDUSTRY_PROFILE;
}
