import "server-only";
import { FgosResult, FgosBreakdown } from './types';
import { getBenchmarksForSector } from './benchmarks';
import { fmp } from '@/lib/fmp/client';

// PESOS DE CALIDAD (FGOS)
const QUALITY_WEIGHTS = {
  growth: 0.20,
  profitability: 0.20,
  efficiency: 0.20,
  solvency: 0.15,
  moat: 0.15,
  sentiment: 0.10 // Sentimiento técnico (Trend), no de precio
};

// PESOS DE VALUACIÓN (THERMOMETER)
const VALUATION_WEIGHTS = {
  pe: 0.40,
  ev_ebitda: 0.35,
  p_fcf: 0.25
};

// Normaliza: 0 a 100
function normalize(value: number | undefined, target: number, higherIsBetter = true): number {
  if (value === undefined || value === null || isNaN(value)) return 50;
  if (target === 0) return 50;

  let score = 0;
  if (higherIsBetter) {
    // Para Calidad: (Valor / Meta) * 60. Si llegas a la meta del sector tienes 60pts (Aprobado).
    score = (value / target) * 60; 
  } else {
    // Para Valuación (Precio): (Meta / Valor) * 50.
    // Si Meta Sector PE es 20, y tu PE es 10 -> (20/10)*50 = 100 (Excelente/Barato)
    // Si Meta Sector PE es 20, y tu PE es 40 -> (20/40)*50 = 25 (Malo/Caro)
    const safeValue = value <= 0 ? 0.1 : value; 
    score = (target / safeValue) * 50; 
  }

  return Math.min(Math.max(score, 0), 100);
}

// CÁLCULO DEL TERMÓMETRO DE PRECIO
function calculateValuationThermometer(
  ratios: any, 
  metrics: any, 
  benchmarks: any
): { score: number, status: string } {
  
  // Extraer Ratios (Soporte CSV y JSON keys)
  const pe = Number(ratios?.priceEarningsRatioTTM || ratios?.peRatioTTM || ratios?.peRatio || 0);
  
  const ev_ebitda = Number(
    ratios?.enterpriseValueMultipleTTM || 
    metrics?.enterpriseValueOverEBITDATTM || 
    ratios?.enterpriseValueMultiple || 
    0
  );

  const p_fcf = Number(
    ratios?.priceToFreeCashFlowsRatioTTM || 
    metrics?.priceToFreeCashFlowsRatioTTM ||
    ratios?.priceToFreeCashFlowsRatio || 
    0
  );

  // Calcular Scores Individuales (false = Menor es mejor)
  const s_pe = normalize(pe, benchmarks.pe_ratio || 15, false);
  const s_ev = normalize(ev_ebitda, benchmarks.ev_ebitda || 12, false);
  const s_fcf = normalize(p_fcf, benchmarks.p_fcf || 15, false);

  const finalValScore = 
    (s_pe * VALUATION_WEIGHTS.pe) +
    (s_ev * VALUATION_WEIGHTS.ev_ebitda) +
    (s_fcf * VALUATION_WEIGHTS.p_fcf);

  // Definir Status
  // > 70: Barato (Undervalued)
  // < 30: Caro (Overvalued)
  let status = 'Justo';
  if (finalValScore >= 70) status = 'Barato';
  else if (finalValScore <= 30) status = 'Caro';

  return { score: Math.round(finalValScore), status };
}

export function calculateFGOSFromData(
  ticker: string,
  profile: any,
  ratios: any,
  metrics: any,
  growth: any,
  quote: any
): FgosResult | null {
  try {
    if (!profile) return null;

    // Normalizar claves CSV/JSON
    const sector = profile.sector || profile.Sector;
    const price = Number(quote?.price || profile?.price || profile?.Price || 0);

    if (!sector) return null;

    const benchmarks = getBenchmarksForSector(sector);

    // --- A. CÁLCULO DE CALIDAD (FGOS) ---
    const revG = Number(growth?.revenueGrowth || 0);
    const incG = Number(growth?.netIncomeGrowth || 0);
    const s_rev = normalize(revG, benchmarks.revenue_growth || 0.10);
    const s_inc = normalize(incG, benchmarks.revenue_growth || 0.10); 
    const scoreGrowth = (s_rev + s_inc) / 2;

    const roe = Number(ratios?.returnOnEquityTTM || ratios?.returnOnEquity || 0);
    const netMargin = Number(ratios?.netProfitMarginTTM || ratios?.netProfitMargin || 0);
    const s_roe = normalize(roe, benchmarks.roe || 0.15);
    const s_margin = normalize(netMargin, benchmarks.net_margin || 0.10);
    const scoreProfitability = (s_roe + s_margin) / 2;

    const roic = Number(metrics?.roicTTM || metrics?.ROIC || 0);
    const assetTurn = Number(ratios?.assetTurnoverTTM || ratios?.assetTurnover || 0.8);
    const s_roic = normalize(roic, benchmarks.roe || 0.15);
    const s_asset_turn = normalize(assetTurn, 0.8);
    const scoreEfficiency = (s_roic + s_asset_turn) / 2;

    const debtEq = Number(ratios?.debtEquityRatioTTM || ratios?.debtEquityRatio || 1.0);
    const intCov = Number(ratios?.interestCoverageTTM || ratios?.interestCoverage || 5);
    const s_debt = normalize(debtEq, benchmarks.debt_to_equity || 1.0, false);
    const s_int = normalize(intCov, 5);
    const scoreSolvency = (s_debt + s_int) / 2;

    const grossMargin = Number(ratios?.grossProfitMarginTTM || ratios?.grossProfitMargin || 0);
    const fcfYield = Number(metrics?.freeCashFlowYieldTTM || metrics?.FreeCashFlowYield || 0);
    const s_gross = normalize(grossMargin, 0.40);
    const s_fcf = normalize(fcfYield, 0.05); 
    const scoreMoat = (s_gross + s_fcf) / 2;

    // Sentiment Técnico (SMA 200)
    const sma200 = Number(quote?.priceAvg200 || price);
    let scoreSentiment = 50;
    if (quote?.priceAvg200 && price > 0) {
        scoreSentiment = price > sma200 ? 75 : 25;
    }

    const fgosScore = 
      (scoreGrowth * QUALITY_WEIGHTS.growth) +
      (scoreProfitability * QUALITY_WEIGHTS.profitability) +
      (scoreEfficiency * QUALITY_WEIGHTS.efficiency) +
      (scoreSolvency * QUALITY_WEIGHTS.solvency) +
      (scoreMoat * QUALITY_WEIGHTS.moat) +
      (scoreSentiment * QUALITY_WEIGHTS.sentiment);

    // --- B. CÁLCULO DE VALUACIÓN ---
    const valuation = calculateValuationThermometer(ratios, metrics, benchmarks);

    // --- C. INVESTMENT VERDICT ---
    // Combinación de Calidad (FGOS) y Valuación
    let investment_verdict = 'Hold';
    if (fgosScore >= 65 && valuation.score >= 70) investment_verdict = 'Strong Buy';
    else if (fgosScore >= 60 && valuation.score >= 50) investment_verdict = 'Buy';
    else if (fgosScore <= 40 || valuation.score <= 30) investment_verdict = 'Sell';

    return {
      ticker: ticker.toUpperCase(),
      fgos_score: Math.round(fgosScore),
      fgos_breakdown: {
        growth: Math.round(scoreGrowth),
        profitability: Math.round(scoreProfitability),
        efficiency: Math.round(scoreEfficiency),
        solvency: Math.round(scoreSolvency),
        moat: Math.round(scoreMoat),
        sentiment: Math.round(scoreSentiment)
      },
      valuation_score: valuation.score,
      valuation_status: valuation.status,
      ecosystem_score: Math.round(fgosScore * 0.9), // Legacy
      calculated_at: new Date().toISOString(),
      price: price,
      investment_verdict,
      sector_pe: benchmarks.pe_ratio
    };

  } catch (error) {
    console.error(`FGOS Brain Error ${ticker}:`, error);
    return null;
  }
}

// Wrapper Legacy
export async function calculateFGOS(ticker: string): Promise<FgosResult | null> {
    const [profileRes, ratiosRes, metricsRes, growthRes, quoteRes] = await Promise.allSettled([
      fmp.profile(ticker),
      fmp.ratiosTTM(ticker),
      fmp.keyMetricsTTM(ticker),
      fmp.growth(ticker),
      fmp.quote(ticker)
    ]);
    
    const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;
    const ratios = ratiosRes.status === 'fulfilled' ? ratiosRes.value?.[0] : {};
    const metrics = metricsRes.status === 'fulfilled' ? metricsRes.value?.[0] : {};
    const growth = growthRes.status === 'fulfilled' ? growthRes.value?.[0] : {};
    const quote = quoteRes.status === 'fulfilled' ? quoteRes.value?.[0] : {};

    return calculateFGOSFromData(ticker, profile, ratios, metrics, growth, quote);
}