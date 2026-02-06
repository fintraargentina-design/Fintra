import {
  getLatestSnapshot,
  getEcosystemDetailed,
} from "@/lib/repository/fintra-db";
import { supabase } from "@/lib/supabase";
import { StockData, StockAnalysis, StockPerformance } from "@/lib/stockQueries";
import { StockEcosystem } from "@/lib/fmp/types";
import { buildFGOSState } from "@/lib/engine/fgos-state";
import { FinancialSnapshot } from "@/lib/engine/types";

export interface TickerFullView {
  stockBasicData: StockData | null;
  stockAnalysis: StockAnalysis | null;
  stockPerformance: StockPerformance | null;
  stockEcosystem: StockEcosystem | null;
  financialSnapshot: FinancialSnapshot | null;
  stockRatios: any;
  stockMetrics: any;
}

/**
 * Get enriched data for multiple tickers (for panels like Sector Analysis or Peers)
 */
export async function getMultipleTickersView(
  tickers: string[],
  signal?: AbortSignal,
): Promise<StockData[]> {
  if (tickers.length === 0) return [];

  const upperTickers = tickers.map((t) => t.toUpperCase());

  // 1. Fetch Snapshots (batched)
  let snapshotQuery = supabase
    .from("fintra_snapshots")
    .select("*")
    .in("ticker", upperTickers)
    .order("snapshot_date", { ascending: false })
    .limit(upperTickers.length * 2); // Get recent snapshots

  if (signal) {
    snapshotQuery = snapshotQuery.abortSignal(signal);
  }

  // 2. Fetch Market State (batched)
  let marketQuery = supabase
    .from("fintra_market_state")
    .select("*")
    .in("ticker", upperTickers);

  if (signal) {
    marketQuery = marketQuery.abortSignal(signal);
  }

  const [snapshotRes, marketRes] = await Promise.all([
    snapshotQuery,
    marketQuery,
  ]);

  if (signal?.aborted) return [];

  const snapshots = snapshotRes.data || [];
  const marketData = marketRes.data || [];

  // Deduplicate snapshots (keep latest per ticker)
  const snapshotMap = new Map<string, any>();
  snapshots.forEach((s) => {
    if (!snapshotMap.has(s.ticker)) {
      snapshotMap.set(s.ticker, s);
    }
  });

  // Map market data
  const marketMap = new Map<string, any>();
  marketData.forEach((m) => marketMap.set(m.ticker, m));

  // Build StockData array
  return upperTickers
    .map((ticker) => {
      const snapshot = snapshotMap.get(ticker);
      const market = marketMap.get(ticker) || {};

      return buildStockDataFromSnapshot(ticker, snapshot, market);
    })
    .filter(Boolean) as StockData[];
}

/**
 * Helper to build StockData from snapshot + market state
 */
function buildStockDataFromSnapshot(
  ticker: string,
  snapshot: any | undefined,
  market: any,
): StockData | null {
  const ps = snapshot?.profile_structural || ({} as any);
  const metrics = ps.metrics || {};
  const identity = ps.identity || {};

  // If no data at all, return null
  if (!snapshot && !market.ticker) return null;

  return {
    symbol: ticker,
    price: market.price || metrics.price || 0,
    beta: market.beta || metrics.beta || 0,
    volAvg: market.volume || metrics.volume || 0,
    mktCap: market.market_cap || metrics.marketCap || 0,
    lastDiv: metrics.lastDividend || 0,
    range: metrics.range || "",
    changes: market.change_percentage || metrics.changePercentage || 0,
    companyName: identity.name || market.company_name || "",
    currency: identity.currency || "USD",
    cik: "",
    isin: "",
    cusip: "",
    exchange: identity.exchange || market.exchange || "",
    exchangeShortName: "",
    industry: identity.industry || market.industry || "",
    website: identity.website || "",
    description: identity.description || "",
    ceo: identity.ceo || "",
    sector: identity.sector || market.sector || "",
    country: identity.country || market.country || "",
    fullTimeEmployees: identity.fullTimeEmployees || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    dcfDiff: 0,
    dcf: 0,
    image: `https://financialmodelingprep.com/image-stock/${ticker}.png`,
    ipoDate: identity.founded || "",
    defaultImage: false,
    isEtf: false,
    isActivelyTrading: true,
    isAdr: false,
    isFund: false,

    // Custom Fintra fields
    datos: {},
    dividendos: {},
    valoracion: snapshot?.valuation || {},

    // Financials
    roe: metrics.roe || null,
    roic: metrics.roic || null,
    net_margin: metrics.netMargin || null,
    gross_margin: metrics.grossMargin || null,
    debt_equity: metrics.debtToEquity || null,
    free_cash_flow: metrics.fcf || null,
    current_ratio: metrics.currentRatio || null,

    // Growth
    revenue_cagr_5y: metrics.revenueCagr5Y || null,
    net_income_cagr_5y: metrics.netIncomeCagr5Y || null,

    // Valuation
    valoracion_pe: metrics.peRatio || null,
    valoracion_pbv: metrics.pbRatio || null,
    dividend_yield: metrics.dividendYield || null,

    // Scores from snapshot (NEW)
    fgos_score: market.fgos_score || snapshot?.fgos_score || null,
    fgos_confidence:
      market.fgos_confidence_percent || snapshot?.fgos_confidence || null,
    fgos_confidence_label: market.fgos_confidence_label || null,
    // Extract Moat Band specifically from fgos_components if available
    fgos_category: snapshot?.fgos_components?.competitive_advantage?.band || '-',
    fgos_status: snapshot?.fgos_status || null,
    fgos_maturity: snapshot?.fgos_maturity || null,
    valuation_status:
      market.valuation_status || snapshot?.valuation?.status || null,
    verdict_text: market.verdict_text || null,
    strategy_state: market.strategy_state || snapshot?.strategy_state || null,

    // Structural Profile & Complex objects
    ifs: snapshot?.ifs || (snapshot?.ifs_position ? {
      position: snapshot.ifs_position,
      pressure: 0
    } : null),
    ifs_fy: snapshot?.ifs_fy || null,
    fgos_components: snapshot?.fgos_components || null,
    raw_profile_structural: snapshot?.profile_structural || null,
    sector_rank: snapshot?.sector_rank || null,
    sector_rank_total: snapshot?.sector_rank_total || null,

    // Market performance
    ytd_return: market.ytd_return || null,
    change_percentage: market.change_percentage || null,

    // Snapshot metadata
    snapshot_date: snapshot?.snapshot_date || null,
    _hasSnapshot: !!snapshot,
  };
}

export async function getTickerFullView(
  ticker: string,
): Promise<TickerFullView> {
  const upperTicker = ticker.toUpperCase();

  // 1. Fetch Snapshot (Single Source of Truth)
  const snapshot = await getLatestSnapshot(upperTicker);

  // 2. Fetch Ecosystem (DB)
  const ecosystemPromise = getEcosystemDetailed(upperTicker);

  // 3. Fetch Market State (for some real-time data if snapshot is old, but snapshot has market_snapshot)
  const marketQuery = supabase
    .from("fintra_market_state")
    .select("*")
    .eq("ticker", upperTicker)
    .maybeSingle();

  const [ecosystem, marketRes] = await Promise.all([
    ecosystemPromise,
    marketQuery,
  ]);

  const market = marketRes.data || {};

  // Use helper function to build stock data
  const stockBasicData = buildStockDataFromSnapshot(
    upperTicker,
    snapshot,
    market,
  );

  if (!stockBasicData) {
    // Return empty structure if no data found
    return {
      stockBasicData: null,
      stockAnalysis: null,
      stockPerformance: null,
      stockEcosystem: null,
      financialSnapshot: null,
      stockRatios: null,
      stockMetrics: null,
    };
  }

  // Map to legacy structures (keeping for backward compatibility)
  const identity = (snapshot as any)?.profile_structural?.identity || {};

  // Map to StockAnalysis
  const stockAnalysis: StockAnalysis = {
    symbol: upperTicker,
    recommendation: market.verdict_text || "Hold", // Simplified
    analyst_rating: market.valuation_status || "Unknown",
    target_price: 0, // Not in snapshot currently
  };

  // Map to StockPerformance
  // We need to fetch performance from datos_performance if not in snapshot/market
  // Market state usually has some performance metrics
  const stockPerformance: StockPerformance = {
    symbol: upperTicker,
    day_1: market.change_percentage || 0,
    ytd: market.ytd_return || 0,
    // Others would require fetching datos_performance
  };

  // Helper to transform ecosystem items for UI
  const transformEco = (items: any[]) =>
    items.map((i) => ({
      id: i.partner_symbol,
      n: i.partner_name,
      dep: i.dependency_score,
      val: i.partner_valuation || 0,
      ehs: i.partner_ehs || 0,
      fgos: i.partner_fgos || 0,
      txt: i.risk_level,
    }));

  // Map Ecosystem
  const stockEcosystem: StockEcosystem = {
    symbol: upperTicker,
    suppliers: transformEco(ecosystem.suppliers),
    clients: transformEco(ecosystem.clients),
  };

  // Map Ratios & Metrics (Raw)
  // These are often used for cards. We can populate them from snapshot metrics
  const metrics = (snapshot as any)?.profile_structural?.metrics || {};
  const stockRatios = {
    symbol: upperTicker,
    ...metrics,
  };

  const stockMetrics = {
    symbol: upperTicker,
    ...metrics,
  };

  return {
    stockBasicData,
    stockAnalysis,
    stockPerformance,
    stockEcosystem,
    financialSnapshot: snapshot as unknown as FinancialSnapshot,
    stockRatios,
    stockMetrics,
  };
}
