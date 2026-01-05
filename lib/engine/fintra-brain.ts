import "server-only";
import { FgosResult, FgosBreakdown } from './types';
import { getBenchmarksForSector } from './benchmarks';
import { fmp } from '@/lib/fmp/client';

const QUALITY_WEIGHTS = {
  growth: 0.20,
  profitability: 0.20,
  efficiency: 0.20,
  solvency: 0.15,
  moat: 0.15,
  sentiment: 0.10
};

const VALUATION_WEIGHTS = {
  pe: 0.40,
  ev_ebitda: 0.35,
  p_fcf: 0.25
};

// Normaliza: 0 a 100. 
// higherIsBetter=true -> Calidad (Más ROE es mejor)
// higherIsBetter=false -> Valuación (Menos PE es mejor/más barato)
function normalize(value: number | undefined, target: number, higherIsBetter = true): number {
  if (value === undefined || value === null || isNaN(value)) return 50;
  if (target === 0) return 50;

  let score = 0;
  if (higherIsBetter) {
    // Calidad: Si tengo 20 ROE y target es 20 -> 50 puntos (Neutral/Cumple)
    // Queremos que target sea el "aprobado". 
    // Ajuste: Si igualo al benchmark sectorial, es un 60 (bueno).
    score = (value / target) * 60; 
  } else {
    // Valuación: Si tengo PE 10 y target es 20 -> Soy más barato -> Mejor puntaje
    // Formula inversa: Target / Value.
    // Ej: Target 20 / Value 10 = 2 * 50 = 100 puntos (Barato)
    // Ej: Target 20 / Value 40 = 0.5 * 50 = 25 puntos (Caro)
    const safeValue = value <= 0 ? 0.1 : value; // Evitar división por cero o negativos en ratios de precio
    score = (target / safeValue) * 50; 
  }

  return Math.min(Math.max(score, 0), 100);
}

// --- CÁLCULO ESPECÍFICO DEL TERMÓMETRO DE VALUACIÓN ---
function calculateValuationThermometer(
  ratios: any, 
  metrics: any, 
  benchmarks: any
): { score: number, status: string } {
  
  // 1. Obtener métricas (Soportando claves de JSON y CSV)
  // PE
  const pe = Number(ratios?.priceEarningsRatioTTM || ratios?.peRatioTTM || ratios?.peRatio || 0);
  
  // EV/EBITDA (A veces viene en metrics como enterpriseValueOverEBITDA)
  const ev_ebitda = Number(
    ratios?.enterpriseValueMultipleTTM || 
    metrics?.enterpriseValueOverEBITDATTM || 
    ratios?.enterpriseValueMultiple || 
    0
  );

  // P/FCF (Price to Free Cash Flow)
  const p_fcf = Number(
    ratios?.priceToFreeCashFlowsRatioTTM || 
    metrics?.priceToFreeCashFlowsRatioTTM ||
    ratios?.priceToFreeCashFlowsRatio || 
    0
  );

  // 2. Calcular Scores Individuales (Lower is Better = true para "Barato")
  // Usamos el benchmark como "Pivote". Si estoy debajo del benchmark, sube el score.
  const s_pe = normalize(pe, benchmarks.pe_ratio || 15, false);
  const s_ev = normalize(ev_ebitda, benchmarks.ev_ebitda || 12, false);
  const s_fcf = normalize(p_fcf, benchmarks.p_fcf || 15, false);

  // 3. Score Ponderado (0 = Muy Caro, 100 = Muy Barato)
  const finalValScore = 
    (s_pe * VALUATION_WEIGHTS.pe) + 
    (s_ev * VALUATION_WEIGHTS.ev_ebitda) +
    (s_fcf * VALUATION_WEIGHTS.p_fcf);

  // 4. Determinar Estado (Percentiles simulados)
  // Score > 70 -> Barato (Undervalued)
  // Score < 30 -> Caro (Overvalued)
  // 30 - 70 -> Justo (Fair)
  
  let status = 'Justo';
  if (finalValScore >= 70) status = 'Barato';
  else if (finalValScore <= 30) status = 'Caro';

  return { score: Math.round(finalValScore), status };
}

// --- FUNCIÓN PURA PRINCIPAL ---
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

    const sector = profile.sector || profile.Sector;
    const price = Number(quote?.price || profile?.price || profile?.Price || 0);

    if (!sector) return null;

    const benchmarks = getBenchmarksForSector(sector);

    // --- A. CÁLCULO DE CALIDAD (FGOS) ---
    // 1. GROWTH
    const revG = Number(growth?.revenueGrowth || 0);
    const incG = Number(growth?.netIncomeGrowth || 0);
    const s_rev = normalize(revG, benchmarks.revenue_growth || 0.10);
    const s_inc = normalize(incG, benchmarks.revenue_growth || 0.10); 
    const scoreGrowth = (s_rev + s_inc) / 2;

    // 2. PROFITABILITY
    const roe = Number(ratios?.returnOnEquityTTM || ratios?.returnOnEquity || 0);
    const netMargin = Number(ratios?.netProfitMarginTTM || ratios?.netProfitMargin || 0);
    const s_roe = normalize(roe, benchmarks.roe || 0.15);
    const s_margin = normalize(netMargin, benchmarks.net_margin || 0.10);
    const scoreProfitability = (s_roe + s_margin) / 2;

    // 3. EFFICIENCY
    const roic = Number(metrics?.roicTTM || metrics?.ROIC || 0);
    const assetTurn = Number(ratios?.assetTurnoverTTM || ratios?.assetTurnover || 0.8);
    const s_roic = normalize(roic, benchmarks.roe || 0.15); // Proxy ROIC ~ ROE ideal
    const s_asset_turn = normalize(assetTurn, 0.8);
    const scoreEfficiency = (s_roic + s_asset_turn) / 2;

    // 4. SOLVENCY
    const debtEq = Number(ratios?.debtEquityRatioTTM || ratios?.debtEquityRatio || 1.0);
    const intCov = Number(ratios?.interestCoverageTTM || ratios?.interestCoverage || 5);
    const s_debt = normalize(debtEq, benchmarks.debt_to_equity || 1.0, false); // Menos es mejor
    const s_int = normalize(intCov, 5);
    const scoreSolvency = (s_debt + s_int) / 2;

    // 5. MOAT
    const grossMargin = Number(ratios?.grossProfitMarginTTM || ratios?.grossProfitMargin || 0);
    const fcfYield = Number(metrics?.freeCashFlowYieldTTM || metrics?.FreeCashFlowYield || 0);
    const s_gross = normalize(grossMargin, 0.40);
    const s_fcf = normalize(fcfYield, 0.05); // 5% yield es sano
    const scoreMoat = (s_gross + s_fcf) / 2;

    // 6. SENTIMENT (Técnico simple)
    const sma200 = Number(quote?.priceAvg200 || price);
    let scoreSentiment = 50;
    if (quote?.priceAvg200 && price > 0) {
        // Si precio > sma200 -> Tendencia alcista -> Sentiment positivo
        scoreSentiment = price > sma200 ? 75 : 25;
    }

    const fgosScore = 
      (scoreGrowth * QUALITY_WEIGHTS.growth) +
      (scoreProfitability * QUALITY_WEIGHTS.profitability) +
      (scoreEfficiency * QUALITY_WEIGHTS.efficiency) +
      (scoreSolvency * QUALITY_WEIGHTS.solvency) +
      (scoreMoat * QUALITY_WEIGHTS.moat) +
      (scoreSentiment * QUALITY_WEIGHTS.sentiment);

    // --- B. CÁLCULO DE PRECIO (VALUATION THERMOMETER) ---
    const valuation = calculateValuationThermometer(ratios, metrics, benchmarks);

    return {
      ticker: ticker.toUpperCase(),
      fgos_score: Math.round(fgosScore), // 0-100 (Calidad)
      fgos_breakdown: {
        growth: Math.round(scoreGrowth),
        profitability: Math.round(scoreProfitability),
        efficiency: Math.round(scoreEfficiency),
        solvency: Math.round(scoreSolvency),
        moat: Math.round(scoreMoat),
        sentiment: Math.round(scoreSentiment)
      },
      // Campos específicos de Valuación
      valuation_score: valuation.score, // 0-100 (Donde 100 es Muy Barato)
      valuation_status: valuation.status, // "Barato", "Justo", "Caro"
      
      // Legacy / Compatibilidad
      ecosystem_score: Math.round(fgosScore * 0.9),
      calculated_at: new Date().toISOString(),
      price: price
    };

  } catch (error) {
    console.error(`FGOS Brain Error ${ticker}:`, error);
    return null;
  }
}

// Wrapper para llamadas individuales
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