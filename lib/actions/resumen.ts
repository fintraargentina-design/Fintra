"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { ResumenData } from "@/lib/repository/fintra-db";

export async function fetchResumenDataServer(ticker: string): Promise<ResumenData | null> {
  const upperTicker = ticker.toUpperCase();

  try {
    // 1. Identity & Structure (fintra_universe)
    const universeQuery = supabaseAdmin
      .from('fintra_universe')
      .select('ticker, exchange')
      .eq('ticker', upperTicker)
      .maybeSingle();

    // 2. Descriptive Profile (company_profile)
    const profileQuery = supabaseAdmin
      .from('company_profile')
      .select('company_name, sector, industry, country, website, ceo, employees, description')
      .eq('ticker', upperTicker)
      .maybeSingle();

    // 3. Market (fintra_market_state)
    const marketQuery = supabaseAdmin
      .from('fintra_market_state')
      .select('price, market_cap, change_percentage, ytd_return, volume, beta, fgos_score, fgos_confidence_label')
      .eq('ticker', upperTicker)
      .maybeSingle();

    // 4. Analysis (fintra_snapshots)
    const snapshotQuery = supabaseAdmin
      .from('fintra_snapshots')
      .select('profile_structural, fgos_maturity, fgos_confidence_percent, fgos_components, fgos_status, valuation, ifs, ifs_position, ifs_years_in_state, ifs_total_years_available, ifs_memory, market_snapshot, fundamentals_growth, sector_rank, sector_rank_total')
      .eq('ticker', upperTicker)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5. Financials (datos_financieros)
    const financialsQuery = supabaseAdmin
      .from('datos_financieros')
      .select('revenue, net_income, free_cash_flow, total_debt, operating_margin, ebitda, total_assets, total_liabilities')
      .eq('ticker', upperTicker)
      .order('period_end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const [universeRes, profileRes, marketRes, snapshotRes, financialsRes] = await Promise.all([
      universeQuery,
      profileQuery,
      marketQuery,
      snapshotQuery,
      financialsQuery
    ]);

    const u: any = universeRes.data || {};
    const p: any = profileRes.data || {};
    const m: any = marketRes.data || {};
    const s: any = snapshotRes.data || {};
    const f: any = financialsRes.data || {};
    
    // Extract financial scores from snapshot if available
    const ps = s.profile_structural as any;
    const marketSnapshot = s.market_snapshot as any; // From snapshot
    // const fundamentalsGrowth = s.fundamentals_growth as any; // From snapshot

    const scores = ps?.financial_scores || {};
    const metrics = ps?.metrics || {};
    const identity = ps?.identity || {};

    const result: ResumenData = {
      // Identity
      ticker: u.ticker || upperTicker,
      name: p.company_name || identity.name || null,
      sector: p.sector || null,
      industry: p.industry || null,
      country: p.country || identity.country || null,
      exchange: u.exchange || identity.exchange || null,
      website: p.website || identity.website || null,
      ceo: p.ceo || identity.ceo || null,
      employees: p.employees || identity.fullTimeEmployees || null,
      description: p.description || identity.description || null,

      // Market
      price: m.price || marketSnapshot?.price || metrics.price || null,
      market_cap: m.market_cap || marketSnapshot?.market_cap || metrics.marketCap || null,
      change_percentage: m.change_percentage || marketSnapshot?.change_percent || metrics.changePercentage || null,
      ytd_return: m.ytd_return || marketSnapshot?.ytd_percent || null,
      volume: m.volume || marketSnapshot?.volume || metrics.volume || null,
      beta: m.beta || metrics.beta || null,
      last_dividend: metrics.lastDividend || null,
      range: metrics.range || null,
      ipo_date: identity.founded || null,

      // Analysis
      altman_z: scores.altman_z ?? null,
      piotroski_score: scores.piotroski_score ?? null,
      total_assets: f.total_assets ?? scores.total_assets ?? null,
      total_liabilities: f.total_liabilities ?? scores.total_liabilities ?? null,
      revenue: f.revenue ?? scores.revenue ?? null,
      ebit: scores.ebit ?? null,
      working_capital: scores.working_capital ?? null,

      netIncome: f.net_income ?? null,
      fcf: f.free_cash_flow ?? null,
      debt: f.total_debt ?? null,
      operatingMargin: f.operating_margin ?? null,
      ebitda: f.ebitda ?? null,
      
      // FGOS Analysis
      fgos_score: m.fgos_score ?? s.fgos_score ?? null,
      fgos_confidence_label: m.fgos_confidence_label ?? null,
      fgos_status: s.fgos_status ?? null,
      fgos_maturity: s.fgos_maturity ?? null,
      fgos_confidence_percent: s.fgos_confidence_percent ?? null,
      fgos_state: null, // Not fetching full state for summary
      fgos_components: s.fgos_components ?? null,
      valuation: s.valuation ?? null,

      // Structural Profile
      ifs: s.ifs ? {
        position: s.ifs.position || s.ifs_position,
        yearsInState: s.ifs.yearsInState || s.ifs_years_in_state,
        totalYearsAvailable: s.ifs.totalYearsAvailable || s.ifs_total_years_available
      } : (s.ifs_position ? {
        position: s.ifs_position,
        yearsInState: s.ifs_years_in_state,
        totalYearsAvailable: s.ifs_total_years_available
      } : null),
      ifs_memory: s.ifs_memory ?? null,
      sector_rank: s.sector_rank ?? null,
      sector_rank_total: s.sector_rank_total ?? null,
      attention_state: null, // Logic to derive this might be complex, leaving null for now or deriving if possible

      // Raw Structural Profile for Widgets
      raw_profile_structural: s.profile_structural || null
    };
    
    // Derive attention_state if possible (simple version)
    // In original code it was coming from s.attention_state which doesn't exist in the select?
    // Wait, in fintra-db.ts select: '...ifs_memory, market_snapshot, fundamentals_growth, sector_rank, sector_rank_total'
    // It doesn't select 'attention_state'.
    // ResumenData has 'attention_state'.
    // The original getResumenData didn't seem to set attention_state explicitly?
    // Let's check original getResumenData again.
    
    return result;

  } catch (error) {
    console.error("Error in fetchResumenDataServer:", error);
    return null;
  }
}
