// Fintra/lib/utils/snapshot-merge.ts
// Utility for merging market_state (fresh) with snapshots (historical)
// NOTE: This utility is now primarily used by ticker-view.service.ts
// Custom hooks (useSectorData, usePeersData) use the service layer instead.

/**
 * Merges market state data (latest prices, returns) with snapshot data (analytics)
 * Priority: market_state overrides snapshot for volatile fields
 *
 * @param marketData - Fresh data from fintra_market_state
 * @param snapshot - Historical data from fintra_snapshots
 * @returns Merged object with market_state priority
 */
export function mergeMarketStateWithSnapshot(
  marketData: any | null | undefined,
  snapshot: any | null | undefined,
): any {
  if (!snapshot) {
    // No snapshot: return market data with defaults
    return {
      ticker: marketData?.ticker,
      company_name: marketData?.company_name || marketData?.ticker,
      sector: marketData?.sector,
      industry: marketData?.industry,
      country: marketData?.country,
      price: marketData?.price,
      market_cap: marketData?.market_cap,
      fgos_score: marketData?.fgos_score,
      fgos_confidence: marketData?.fgos_confidence_percent,
      fgos_category: null,
      fgos_components: null,
      valuation_status: marketData?.valuation_status || "pending",
      competitive_advantage: null,
      investment_verdict: null,
      snapshot_date: null,
      ytd_return: marketData?.ytd_return,
      change_percentage: marketData?.change_percentage,
      volume: marketData?.volume,
      fgos_confidence_label: marketData?.fgos_confidence_label,
      verdict_text: marketData?.verdict_text,
      strategy_state: marketData?.strategy_state || null,
      _hasSnapshot: false,
    };
  }

  // Snapshot exists: merge with market_state priority
  return {
    ...snapshot,
    // Override volatile fields with fresh market_state data
    price: marketData?.price ?? snapshot.price,
    market_cap: marketData?.market_cap ?? snapshot.market_cap,
    fgos_score: marketData?.fgos_score ?? snapshot.fgos_score,
    ytd_return: marketData?.ytd_return ?? snapshot.ytd_return,
    change_percentage:
      marketData?.change_percentage ?? snapshot.change_percentage,
    volume: marketData?.volume ?? snapshot.volume,
    company_name: marketData?.company_name || snapshot.company_name,
    sector: marketData?.sector || snapshot.sector,
    industry: marketData?.industry || snapshot.industry,
    country: marketData?.country || snapshot.country,
    fgos_confidence_label:
      marketData?.fgos_confidence_label ?? snapshot.fgos_confidence_label,
    valuation_status: marketData?.valuation_status || snapshot.valuation_status,
    verdict_text: marketData?.verdict_text ?? snapshot.verdict_text,
    strategy_state: marketData?.strategy_state || snapshot.strategy_state,
    _hasSnapshot: true,
  };
}

/**
 * Creates a Map of tickers to their latest snapshots (deduplicated by date)
 *
 * @param snapshots - Array of snapshots (may contain duplicates)
 * @returns Map with ticker as key, latest snapshot as value
 */
export function deduplicateSnapshotsByTicker(
  snapshots: any[],
): Map<string, any> {
  const snapshotMap = new Map<string, any>();

  if (!snapshots || snapshots.length === 0) {
    return snapshotMap;
  }

  // Sort by date descending first (newest first)
  const sorted = [...snapshots].sort((a, b) => {
    const dateA = new Date(a.snapshot_date || 0).getTime();
    const dateB = new Date(b.snapshot_date || 0).getTime();
    return dateB - dateA;
  });

  // Keep only the first (latest) snapshot per ticker
  sorted.forEach((s: any) => {
    if (!snapshotMap.has(s.ticker)) {
      snapshotMap.set(s.ticker, s);
    }
  });

  return snapshotMap;
}
