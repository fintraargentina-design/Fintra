
import { getLatestSnapshot, getEcosystemDetailed } from '@/lib/repository/fintra-db';
import { supabase } from '@/lib/supabase';
import { StockData, StockAnalysis, StockPerformance } from '@/lib/stockQueries';
import { StockEcosystem } from '@/lib/fmp/types';
import { buildFGOSState } from '@/lib/engine/fgos-state';

export interface TickerFullView {
  stockBasicData: StockData | null;
  stockAnalysis: StockAnalysis | null;
  stockPerformance: StockPerformance | null;
  stockEcosystem: StockEcosystem | null;
  stockRatios: any;
  stockMetrics: any;
}

export async function getTickerFullView(ticker: string): Promise<TickerFullView> {
  const upperTicker = ticker.toUpperCase();

  // 1. Fetch Snapshot (Single Source of Truth)
  const snapshot = await getLatestSnapshot(upperTicker);

  // 2. Fetch Ecosystem (DB)
  const ecosystemPromise = getEcosystemDetailed(upperTicker);
  
  // 3. Fetch Market State (for some real-time data if snapshot is old, but snapshot has market_snapshot)
  const marketQuery = supabase
    .from('fintra_market_state')
    .select('*')
    .eq('ticker', upperTicker)
    .maybeSingle();

  const [ecosystem, marketRes] = await Promise.all([
    ecosystemPromise,
    marketQuery
  ]);

  const market = marketRes.data || {};

  // If no snapshot, we might want to return null or try to fetch from FMP (but we want DB first)
  // For now, if no snapshot, we return what we have from market state
  
  const ps = snapshot?.profile_structural || {} as any;
  const metrics = ps.metrics || {};
  const identity = ps.identity || {};
  const scores = ps.financial_scores || {};

  // Map to StockData (Legacy FMP structure)
  const stockBasicData: StockData = {
    symbol: upperTicker,
    price: market.price || metrics.price || 0,
    beta: market.beta || metrics.beta || 0,
    volAvg: market.volume || metrics.volume || 0,
    mktCap: market.market_cap || metrics.marketCap || 0,
    lastDiv: metrics.lastDividend || 0,
    range: metrics.range || "",
    changes: market.change_percentage || metrics.changePercentage || 0,
    companyName: identity.name || "",
    currency: identity.currency || "USD",
    cik: "",
    isin: "",
    cusip: "",
    exchange: identity.exchange || "",
    exchangeShortName: "",
    industry: identity.industry || "",
    website: identity.website || "",
    description: identity.description || "",
    ceo: identity.ceo || "",
    sector: identity.sector || "",
    country: identity.country || "",
    fullTimeEmployees: identity.fullTimeEmployees || "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    dcfDiff: 0,
    dcf: 0,
    image: `https://financialmodelingprep.com/image-stock/${upperTicker}.png`,
    ipoDate: identity.founded || "",
    defaultImage: false,
    isEtf: false, // TODO: Check in DB
    isActivelyTrading: true,
    isAdr: false,
    isFund: false,
    
    // Custom Fintra fields
    datos: {}, // Legacy
    dividendos: {}, // Legacy
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
  };

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

  // Map Ecosystem
  const stockEcosystem: StockEcosystem = {
    symbol: upperTicker,
    suppliers: ecosystem.suppliers,
    clients: ecosystem.clients,
  };

  // Map Ratios & Metrics (Raw)
  // These are often used for cards. We can populate them from snapshot metrics
  const stockRatios = {
    symbol: upperTicker,
    ...metrics
  };
  
  const stockMetrics = {
    symbol: upperTicker,
    ...metrics
  };

  return {
    stockBasicData,
    stockAnalysis,
    stockPerformance,
    stockEcosystem,
    stockRatios,
    stockMetrics
  };
}
