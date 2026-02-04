"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { EnrichedStockData } from "@/lib/engine/types";

interface SectorFilters {
  selectedSector?: string;
  selectedIndustry?: string;
  selectedCountry?: string;
  page?: number;
  pageSize?: number;
}

interface SectorAnalysisResult {
  stocks: any[]; // Raw snapshot data (not EnrichedStockData)
  hasMore: boolean;
  dataQuality: {
    marketDataCount: number;
    snapshotDataCount: number;
    completeness: number;
  };
}

/**
 * Server Action: Fetch sector stocks with filters
 * Used by SectorAnalysisPanel via useSectorData hook
 *
 * @param filters - Sector/industry/country filters + pagination
 * @returns Enriched stock data with quality metrics
 */
export async function fetchSectorStocks(
  filters: SectorFilters,
): Promise<SectorAnalysisResult> {
  const {
    selectedCountry,
    selectedSector,
    selectedIndustry,
    page = 0,
    pageSize = 1000,
  } = filters;

  try {
    // Requires at least a Country to be selected
    if (!selectedCountry) {
      return {
        stocks: [],
        hasMore: false,
        dataQuality: {
          marketDataCount: 0,
          snapshotDataCount: 0,
          completeness: 0,
        },
      };
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    // STEP 1: Fetch Market State (optimized query)
    let query = supabaseAdmin.from("fintra_market_state").select(`
        ticker,
        company_name,
        sector,
        industry,
        country,
        market_cap,
        fgos_score,
        price,
        ytd_return,
        change_percentage,
        volume,
        fgos_confidence_label,
        fgos_confidence_percent,
        valuation_status,
        verdict_text
      `);

    // Apply cascading filters
    if (selectedCountry && selectedCountry !== "All Countries") {
      query = query.eq("country", selectedCountry);
    }

    if (selectedSector && selectedSector !== "All Sectors") {
      query = query.eq("sector", selectedSector);
    }

    if (
      selectedIndustry &&
      selectedIndustry !== "All Industries" &&
      selectedIndustry !== "Todas"
    ) {
      query = query.eq("industry", selectedIndustry);
    }

    // Sort by FGOS Score (descending)
    query = query
      .order("fgos_score", { ascending: false, nullsFirst: false })
      .range(from, to);

    const { data: marketData, error: marketError } = await query;

    console.log("📊 [fetchSectorStocks] Market data:", {
      count: marketData?.length || 0,
      hasError: !!marketError,
      error: marketError,
    });

    if (marketError) throw marketError;

    if (!marketData || marketData.length === 0) {
      return {
        stocks: [],
        hasMore: false,
        dataQuality: {
          marketDataCount: 0,
          snapshotDataCount: 0,
          completeness: 0,
        },
      };
    }

    const hasMore = marketData.length === pageSize;
    const tickers = marketData.map((m) => m.ticker);

    // STEP 2: Fetch Latest Snapshots (batched)
    const [snapshotsResult, windowsResult] = await Promise.all([
      supabaseAdmin
        .from("fintra_snapshots")
        .select(
          `
        ticker,
        snapshot_date,
        fgos_score,
        fgos_category,
        fgos_components,
        valuation,
        market_position,
        investment_verdict,
        ifs,
        ifs_memory,
        ifs_fy,
        sector_rank,
        sector_rank_total,
        fgos_maturity,
        fgos_status,
        market_snapshot,
        relative_vs_sector_1y,
        profile_structural
      `,
        )
        .in("ticker", tickers)
        .order("ticker", { ascending: true })
        .order("snapshot_date", { ascending: false }),

      supabaseAdmin
        .from("performance_windows")
        .select("ticker, benchmark_ticker, alpha")
        .in("ticker", tickers)
        .eq("window_code", "1Y"),
    ]);

    const snapshotsArray = snapshotsResult.data || [];
    const windowsArray = windowsResult.data || [];

    console.log("📸 [fetchSectorStocks] Snapshots:", {
      count: snapshotsArray.length,
      tickers: tickers.slice(0, 5),
    });

    // Create windows map for efficient lookup
    const windowsByTicker = new Map<string, any[]>();
    windowsArray.forEach((w: any) => {
      const existing = windowsByTicker.get(w.ticker) || [];
      existing.push(w);
      windowsByTicker.set(w.ticker, existing);
    });

    // STEP 3: Deduplicate snapshots (keep latest per ticker)

    // STEP 3: Deduplicate snapshots (keep latest per ticker)
    const snapshotMap = new Map<string, any>();
    snapshotsArray.forEach((s: any) => {
      if (!snapshotMap.has(s.ticker)) {
        snapshotMap.set(s.ticker, s);
      }
    });

    // STEP 4: Calculate data quality
    const completeness =
      marketData.length > 0 ? (snapshotMap.size / marketData.length) * 100 : 0;

    // STEP 5: Merge market_state + snapshots and return RAW data for mapping
    // TablaIFS expects raw snapshot structure, not pre-mapped EnrichedStockData
    const mergedData = marketData.map((m: any) => {
      const snap = snapshotMap.get(m.ticker);
      
      // Get Alpha values
      const mWindows = windowsByTicker.get(m.ticker) || [];
      const alphaIndustry = mWindows.find((w: any) => w.benchmark_ticker === m.industry)?.alpha ?? null;
      const alphaSector = mWindows.find((w: any) => w.benchmark_ticker === m.sector)?.alpha ?? null;

      if (!snap) {
        // Market data only (no snapshot) - create minimal structure
        return {
          ticker: m.ticker,
          fgos_score: m.fgos_score,
          fgos_status: null,
          fgos_category: null,
          sector_rank: null,
          sector_rank_total: null,
          sector_valuation_status: m.valuation_status || null,
          ifs: null,
          ifs_memory: null,
          market_snapshot: {
            price: m.price,
            market_cap: m.market_cap,
            ytd_percent: m.ytd_return,
          },
          price: m.price,
          ytd_return: m.ytd_return,
          market_cap: m.market_cap,
          relative_vs_sector_1y: null,
          alpha_vs_industry_1y: alphaIndustry,
          alpha_vs_sector_1y: alphaSector,
        };
      }

      // Merge: market_state overrides snapshot for volatile data
      return {
        ...snap,
        // Override with fresh market data
        market_snapshot: {
          ...snap.market_snapshot,
          price: m.price ?? snap.market_snapshot?.price,
          market_cap: m.market_cap ?? snap.market_snapshot?.market_cap,
          ytd_percent: m.ytd_return ?? snap.market_snapshot?.ytd_percent,
        },
        fgos_score: m.fgos_score ?? snap.fgos_score,
        sector_valuation_status:
          m.valuation_status || snap.valuation?.status || null,
        // Add Alpha values
        alpha_vs_industry_1y: alphaIndustry,
        alpha_vs_sector_1y: alphaSector,
      };
    });

    // STEP 6: Sort by FGOS Score
    mergedData.sort((a: any, b: any) => {
      const scoreA = a.fgos_score ?? -Infinity;
      const scoreB = b.fgos_score ?? -Infinity;
      return scoreB - scoreA;
    });
    console.log("✅ [fetchSectorStocks] Returning:", {
      mergedCount: mergedData.length,
      hasMore,
      completeness: completeness.toFixed(1) + "%",
      firstTicker: mergedData[0]?.ticker,
    });
    return {
      stocks: mergedData, // Return RAW snapshot data for TablaIFS to map
      hasMore,
      dataQuality: {
        marketDataCount: marketData.length,
        snapshotDataCount: snapshotMap.size,
        completeness,
      },
    };
  } catch (error) {
    console.error("Error in fetchSectorStocks:", error);
    return {
      stocks: [],
      hasMore: false,
      dataQuality: {
        marketDataCount: 0,
        snapshotDataCount: 0,
        completeness: 0,
      },
    };
  }
}
