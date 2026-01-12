import { supabase } from '@/lib/supabase';
import { FintraSnapshotDB, EcosystemRelationDB, EcosystemDataJSON, EcoNodeJSON, EcosystemReportDB } from '@/lib/engine/types';
import { getIntradayPrice } from "@/lib/services/market-data-service";

export type OverviewData = {
  // Identity
  ticker: string
  name: string | null
  logo_url: string | null

  // Market (fintra_market_state)
  price: number | null
  change_percentage: number | null

  // Analysis summary (fintra_market_state)
  fgos_score: number | null
  valuation_status: string | null
  verdict_text: string | null
  ecosystem_score: number | null
}

export async function getOverviewData(ticker: string): Promise<OverviewData> {
  const upperTicker = ticker.toUpperCase();

  // 1. Identity (fintra_universe)
  const universeQuery = supabase
    .from('fintra_universe')
    .select('ticker, name')
    .eq('ticker', upperTicker)
    .maybeSingle();

  // 2. Market & Analysis (fintra_market_state)
  const marketQuery = supabase
    .from('fintra_market_state')
    .select('price, change_percentage, fgos_score, valuation_status, verdict_text, ecosystem_score')
    .eq('ticker', upperTicker)
    .maybeSingle();

  // 3. Intraday (Server-side Resolver)
  const intradayPromise = getIntradayPrice(upperTicker);

  const [universeRes, marketRes, intradayData] = await Promise.all([
    universeQuery,
    marketQuery,
    intradayPromise
  ]);

  const u = (universeRes.data || {}) as any;
  const m = (marketRes.data || {}) as any;

  // Fallback logo logic (deterministic, no fetch)
  const logo_url = `https://financialmodelingprep.com/image-stock/${upperTicker}.png`;

  return {
    ticker: u.ticker || upperTicker,
    name: u.name || null,
    logo_url: logo_url,

    price: intradayData.price ?? m.price ?? null,
    change_percentage: intradayData.change_percentage ?? m.change_percentage ?? null,

    fgos_score: m.fgos_score || null,
    valuation_status: m.valuation_status || null,
    verdict_text: m.verdict_text || null,
    ecosystem_score: m.ecosystem_score || null
  };
}

export type ResumenData = {
  // Identity (fintra_universe)
  ticker: string
  name: string | null
  sector: string | null
  industry: string | null
  country: string | null
  exchange: string | null
  website: string | null
  ceo: string | null
  employees: number | null
  description: string | null

  // Market (fintra_market_state)
  price: number | null
  market_cap: number | null
  change_percentage: number | null
  ytd_return: number | null
  volume: number | null
  beta: number | null

  // Analysis (fintra_snapshots)
  altman_z: number | null
  piotroski_score: number | null
  total_assets: number | null
  total_liabilities: number | null
  revenue: number | null
  ebit: number | null
  working_capital: number | null
}

export async function getResumenData(ticker: string): Promise<ResumenData> {
  const upperTicker = ticker.toUpperCase();

  // 1. Identity (fintra_universe)
  const universeQuery = supabase
    .from('fintra_universe')
    .select('ticker, name, sector, industry, country, exchange, website, ceo, full_time_employees, description')
    .eq('ticker', upperTicker)
    .maybeSingle();

  // 2. Market (fintra_market_state)
  const marketQuery = supabase
    .from('fintra_market_state')
    .select('price, market_cap, change_percentage, ytd_return, volume, beta')
    .eq('ticker', upperTicker)
    .maybeSingle();

  // 3. Analysis (fintra_snapshots)
  const snapshotQuery = supabase
    .from('fintra_snapshots')
    .select('profile_structural')
    .eq('ticker', upperTicker)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [universeRes, marketRes, snapshotRes] = await Promise.all([
    universeQuery,
    marketQuery,
    snapshotQuery
  ]);

  const u: any = universeRes.data || {};
  const m: any = marketRes.data || {};
  
  // Extract financial scores from snapshot if available
  const ps = snapshotRes.data?.profile_structural as any;
  const scores = ps?.financial_scores || {};

  return {
    // Identity
    ticker: u.ticker || upperTicker,
    name: u.name || null,
    sector: u.sector || null,
    industry: u.industry || null,
    country: u.country || null,
    exchange: u.exchange || null,
    website: u.website || null,
    ceo: u.ceo || null,
    employees: u.full_time_employees || null,
    description: u.description || null,

    // Market
    price: m.price || null,
    market_cap: m.market_cap || null,
    change_percentage: m.change_percentage || null,
    ytd_return: m.ytd_return || null,
    volume: m.volume || null,
    beta: m.beta || null,

    // Analysis
    altman_z: scores.altman_z ?? null,
    piotroski_score: scores.piotroski_score ?? null,
    total_assets: scores.total_assets ?? null,
    total_liabilities: scores.total_liabilities ?? null,
    revenue: scores.revenue ?? null,
    ebit: scores.ebit ?? null,
    working_capital: scores.working_capital ?? null,
  };
}

export async function getLatestSnapshot(ticker: string): Promise<FintraSnapshotDB | null> {
    const { data, error } = await supabase
      .from('fintra_snapshots')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
  
    if (error) {
      console.error('Error fetching snapshot:', error);
      return null;
    }
  
    return data as FintraSnapshotDB;
  }

export async function getEcosystemDetailed(ticker: string) {
   const upperTicker = ticker.toUpperCase();
   
   // Fetch relations
   const { data: relations, error } = await supabase
     .from('fintra_ecosystem_relations')
     .select('*')
     .eq('ticker', upperTicker);
 
   if (error || !relations) {
     return { suppliers: [], clients: [] };
   }
 
   // Get unique related tickers
   const relatedTickers = [...new Set(relations.map((r: any) => r.related_ticker))];
 
   if (relatedTickers.length === 0) {
       return { suppliers: [], clients: [] };
   }
 
   // Fetch details for related tickers
   // Universe for names
   const { data: universeData } = await supabase
     .from('fintra_universe')
     .select('ticker, name')
     .in('ticker', relatedTickers);
     
   // Market for scores
   const { data: marketData } = await supabase
     .from('fintra_market_state')
     .select('ticker, fgos_score, ecosystem_score, valuation_status, verdict_text')
     .in('ticker', relatedTickers);
 
   // Map helper
   const universeMap = new Map((universeData || []).map((u: any) => [u.ticker, u]));
   const marketMap = new Map((marketData || []).map((m: any) => [m.ticker, m]));
 
   const suppliers: any[] = [];
   const clients: any[] = [];
 
   for (const r of relations as any[]) {
      const u = universeMap.get(r.related_ticker);
      const m = marketMap.get(r.related_ticker);
 
      // Note: valuation_score might not be in market_state, using valuation_status or 0 for now if score missing
      // Page.tsx expects a number for valuation? "val: i.partner_valuation || 0"
      // If we don't have a numeric score, we can leave it 0 or try to map status.
      // For now 0 is safe.
      
      const item = {
         partner_symbol: r.related_ticker,
         partner_name: u?.name || r.related_ticker,
         dependency_score: r.confidence || 0, 
         partner_valuation: 0, // Placeholder as valuation_score is not always available
         partner_ehs: m?.ecosystem_score || 0,
         partner_fgos: m?.fgos_score || 0,
         risk_level: m?.verdict_text || null 
      };
 
      if (r.relation_type === 'supplier') {
         suppliers.push(item);
      } else if (r.relation_type === 'client') {
         clients.push(item);
      }
   }
 
   return { suppliers, clients };
}

export async function getAvailableSectors(): Promise<string[]> {
  // Use fintra_sector_benchmarks as it is much smaller and represents active sectors
  const { data, error } = await supabase
    .from('fintra_sector_benchmarks')
    .select('sector');

  if (error) {
    console.warn('Sector benchmarks fetch failed (using fallback):', error.message || error);
    // Fallback to universe if benchmarks are empty (cold start)
    const { data: uData, error: uError } = await supabase
        .from('fintra_universe')
        .select('sector')
        .not('sector', 'is', null);
        
    if (uError || !uData) return [];
    
    return Array.from(new Set(uData.map(d => d.sector).filter(Boolean) as string[])).sort();
  }

  if (!data) return [];

  const sectors = Array.from(new Set(data.map(d => d.sector).filter(Boolean) as string[])).sort();
  return sectors;
}

export async function getLatestEcosystemReport(ticker: string): Promise<EcosystemReportDB | null> {
  // Fetch latest ecosystem report from DB
  const { data, error } = await supabase
    .from('fintra_ecosystem_reports')
    .select('*')
    .eq('ticker', ticker.toUpperCase())
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[getLatestEcosystemReport] Error fetching report for ${ticker}:`, error);
    return null;
  }

  return data as EcosystemReportDB;
}

export async function saveEcosystemReport(input: {
  mainTicker: string;
  suppliers: EcoNodeJSON[];
  clients: EcoNodeJSON[];
  report: string;
}): Promise<{ score: number }> {
  const ticker = input.mainTicker.toUpperCase();
  
  const supplierCount = input.suppliers.length;
  const clientCount = input.clients.length;
  const calculatedScore = Math.min(100, 50 + (supplierCount + clientCount) * 2);

  const row = {
    ticker: ticker,
    date: new Date().toISOString(),
    data: {
      suppliers: input.suppliers,
      clients: input.clients
    },
    ecosystem_score: calculatedScore,
    report_md: input.report
  };

  const { error } = await supabase
    .from('fintra_ecosystem_reports')
    .insert(row);

  if (error) {
    console.error(`[saveEcosystemReport] Error saving report for ${ticker}:`, error);
    throw error;
  }

  return { score: calculatedScore };
}
