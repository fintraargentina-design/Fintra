"use server";

import { ResumenData } from "@/lib/repository/fintra-db";
import { getTickerFullView } from "@/lib/services/ticker-view.service";

export async function fetchResumenDataServer(ticker: string): Promise<ResumenData | null> {
  const upperTicker = ticker.toUpperCase();

  try {
    // 1. Fetch data using the centralized service (Single Source of Truth)
    // This ensures consistency between Web and future Desktop clients
    const fullView = await getTickerFullView(upperTicker);

    if (!fullView || !fullView.stockBasicData) {
      return null;
    }

    const d = fullView.stockBasicData;
    // stockMetrics and stockRatios are populated in getTickerFullView from snapshot.metrics
    const m = fullView.stockMetrics || {};
    const r = fullView.stockRatios || {};
    
    // Helper to safely get numbers
    const num = (val: any) => {
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
    };

    // Helper to get string or null
    const str = (val: any) => (val ? String(val) : null);

    const result: ResumenData = {
      // Identity
      ticker: d.symbol,
      name: str(d.companyName),
      sector: str(d.sector),
      industry: str(d.industry),
      country: str(d.country),
      exchange: str(d.exchange),
      website: str(d.website),
      ceo: str(d.ceo),
      employees: num(d.fullTimeEmployees),
      description: str(d.description),

      // Market
      price: num(d.price),
      market_cap: num(d.mktCap),
      change_percentage: num(d.changes),
      ytd_return: num(d.ytd_return),
      volume: num(d.volAvg),
      beta: num(d.beta),
      last_dividend: num(d.lastDiv),
      range: str(d.range),
      ipo_date: str(d.ipoDate),

      // Analysis
      // Mapping keys from stockRatios/metrics which come from snapshot
      altman_z: num(r.altmanZScore || r.altman_z),
      piotroski_score: num(r.piotroskiScore || r.piotroski_score),
      total_assets: num(m.totalAssets || m.total_assets),
      total_liabilities: num(m.totalLiabilities || m.total_liabilities),
      revenue: num(m.revenue),
      ebit: num(m.ebit),
      working_capital: num(r.workingCapital || r.working_capital),

      netIncome: num(m.netIncome || m.net_income),
      fcf: num(d.free_cash_flow || m.fcf || m.free_cash_flow),
      debt: num(d.debt_equity || m.totalDebt || m.total_debt), // debt_equity is ratio, debt is absolute. Check m first
      operatingMargin: num(d.operating_margin || r.operatingMargin || r.operating_margin),
      ebitda: num(m.ebitda),
      
      // FGOS Analysis
      fgos_score: num(d.fgos_score),
      fgos_confidence_label: str(d.fgos_confidence_label),
      fgos_status: str(d.fgos_status),
      fgos_maturity: str(d.fgos_category),
      fgos_confidence_percent: num(d.fgos_confidence),
      fgos_state: null, 
      fgos_components: d.fgos_components || null,
      valuation: d.valoracion || null,

      // Structural Profile
      ifs: d.ifs || null,
      ifs_fy: d.ifs_fy || null,
      sector_rank: num(d.sector_rank),
      sector_rank_total: num(d.sector_rank_total),
      attention_state: d.strategy_state || null,

      // Raw Structural Profile for Widgets
      raw_profile_structural: d.raw_profile_structural || null
    };
    
    return result;

  } catch (error) {
    console.error("Error in fetchResumenDataServer:", error);
    return null;
  }
}
