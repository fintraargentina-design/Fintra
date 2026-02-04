"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Server Action: Fetch peer companies data
 * Used by PeersAnalysisPanel via usePeersData hook
 *
 * @param ticker - Stock ticker to find peers for
 * @returns Array of raw snapshot data (for TablaIFS mapping)
 */
export async function fetchPeersData(ticker: string): Promise<any[]> {
  if (!ticker) return [];

  const upperTicker = ticker.toUpperCase();
  console.log("🚀 [fetchPeersData] Starting for ticker:", upperTicker);

  try {
    // STEP 1: Get peers list from stock_peers table
    const { data: peerRows, error: peerError } = await supabaseAdmin
      .from("stock_peers")
      .select("peer_ticker")
      .eq("ticker", upperTicker)
      .limit(20);

    console.log("📋 [fetchPeersData] Peers found:", peerRows?.length || 0);

    if (peerError) {
      console.error("Error fetching peers:", peerError);
      return [];
    }

    let peersList: string[] = peerRows
      ? peerRows.map((r: any) => r.peer_ticker)
      : [];

    // Filter out invalid tickers
    peersList = peersList.filter((p) => {
      if (!p || typeof p !== "string") return false;
      const clean = p.trim();
      return clean.length > 0 && /^[A-Z0-9.\-\^]+$/i.test(clean);
    });

    // Limit to 8 peers
    peersList = peersList.slice(0, 8);

    if (peersList.length === 0) {
      return [];
    }

    // STEP 2: Fetch snapshots for peers (batched)
    const snapshotQuery = supabaseAdmin
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
        sector_rank,
        sector_rank_total,
        fgos_maturity,
        fgos_status,
        market_snapshot,
        relative_vs_sector_1y,
        profile_structural
      `,
      )
      .in("ticker", peersList)
      .order("snapshot_date", { ascending: false })
      .limit(50); // Enough to cover all peers

    const { data: snapshots, error: snapError } = await snapshotQuery;

    if (snapError) {
      console.error("Error fetching peer snapshots:", snapError);
      return [];
    }

    const snapshotsArray = (snapshots || []) as any[];
    const tickers = [...new Set(snapshotsArray.map((s) => s.ticker))];

    // STEP 3: Fetch Market State for these tickers (batched)
    const marketQuery = supabaseAdmin
      .from("fintra_market_state")
      .select(
        `
        ticker,
        company_name,
        sector,
        industry,
        country,
        market_cap,
        price,
        ytd_return,
        change_percentage,
        volume,
        fgos_score,
        fgos_confidence_label,
        fgos_confidence_percent,
        valuation_status,
        verdict_text
      `,
      )
      .in("ticker", tickers);

    const { data: marketData } = await marketQuery;

    // STEP 4: Build maps for efficient lookup
    const marketMap = new Map<string, any>();
    if (marketData) {
      marketData.forEach((m: any) => marketMap.set(m.ticker, m));
    }

    // Deduplicate snapshots (keep latest per ticker)
    const snapshotMap = new Map<string, any>();
    snapshotsArray.forEach((s: any) => {
      if (!snapshotMap.has(s.ticker)) {
        snapshotMap.set(s.ticker, s);
      }
    });

    // STEP 5: Merge and return RAW snapshot data (for TablaIFS mapping)
    const mergedData = Array.from(snapshotMap.values()).map((snap: any) => {
      const market = marketMap.get(snap.ticker) || {};

      return {
        ...snap,
        // Override with fresh market data
        market_snapshot: {
          ...snap.market_snapshot,
          price: market.price ?? snap.market_snapshot?.price,
          market_cap: market.market_cap ?? snap.market_snapshot?.market_cap,
          ytd_percent: market.ytd_return ?? snap.market_snapshot?.ytd_percent,
        },
        fgos_score: market.fgos_score ?? snap.fgos_score,
        sector_valuation_status:
          market.valuation_status || snap.valuation?.status || null,
      };
    });

    // STEP 6: Sort by FGOS Score
    mergedData.sort((a: any, b: any) => {
      const scoreA = a.fgos_score ?? -Infinity;
      const scoreB = b.fgos_score ?? -Infinity;
      return scoreB - scoreA;
    });

    console.log("✅ [fetchPeersData] Returning:", {
      count: mergedData.length,
      tickers: mergedData.map((d) => d.ticker),
    });

    return mergedData; // Return RAW snapshot data
  } catch (error) {
    console.error("Error in fetchPeersData:", error);
    return [];
  }
}
