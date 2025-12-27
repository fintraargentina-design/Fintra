import "server-only";
import { FgosResult, FgosBreakdown } from './types';
import { getBenchmarksForSector } from './benchmarks';
import { fmpDirect as fmp } from '@/lib/fmp/direct';
import { 
  FMPFinancialRatio, 
  FMPKeyMetrics, 
  FMPIncomeStatementGrowth, 
  FMPCompanyProfile 
} from '@/lib/fmp/types';

// Pesos definidos
const WEIGHTS = {
  growth: 0.20,
  profitability: 0.20,
  efficiency: 0.20,
  solvency: 0.15,
  moat: 0.15,
  sentiment: 0.10
};

// Helper de normalización (0-100)
function normalize(value: number | undefined, target: number, higherIsBetter = true): number {
  if (value === undefined || value === null) return 50; // Neutral
  if (target === 0) return 50; // Evitar división por cero

  let score = 0;
  if (higherIsBetter) {
    score = (value / target) * 50; // Si value == target -> 50. Si value == 2*target -> 100
  } else {
    // Para métricas donde menor es mejor (ej. DEBT/EQ, PE)
    // Si value es la mitad del target (mejor), score debería ser alto
    score = (target / (value === 0 ? 0.01 : value)) * 50;
  }

  return Math.min(Math.max(score, 0), 100); // Clamp 0-100
}

export async function calculateFGOS(ticker: string): Promise<FgosResult | null> {
  try {
    const [profileRes, ratiosRes, metricsRes, growthRes, quoteRes] = await Promise.allSettled([
      fmp.profile(ticker),
      fmp.ratiosTTM(ticker),
      fmp.keyMetricsTTM(ticker),
      fmp.growth(ticker),
      fmp.quote(ticker)
    ]);

    if (profileRes.status === 'rejected') console.error('Profile Fetch Error:', profileRes.reason);
    if (ratiosRes.status === 'rejected') console.error('Ratios Fetch Error:', ratiosRes.reason);
    if (metricsRes.status === 'rejected') console.error('Metrics Fetch Error:', metricsRes.reason);
    if (growthRes.status === 'rejected') console.error('Growth Fetch Error:', growthRes.reason);
    if (quoteRes.status === 'rejected') console.error('Quote Fetch Error:', quoteRes.reason);

    const profile = profileRes.status === 'fulfilled' && profileRes.value?.[0] ? profileRes.value[0] : null;
    const ratios: Partial<FMPFinancialRatio> = ratiosRes.status === 'fulfilled' && ratiosRes.value?.[0] ? ratiosRes.value[0] : {};
    const metrics: Partial<FMPKeyMetrics> = metricsRes.status === 'fulfilled' && metricsRes.value?.[0] ? metricsRes.value[0] : {};
    const growth: Partial<FMPIncomeStatementGrowth> = growthRes.status === 'fulfilled' && growthRes.value?.[0] ? growthRes.value[0] : {};
    const quote = quoteRes.status === 'fulfilled' && quoteRes.value?.[0] ? quoteRes.value[0] : {};

    if (!profile) return null;

    const benchmarks = getBenchmarksForSector(profile.sector);

    // 1. GROWTH (20%) - Revenue & Net Income Growth
    const s_rev = normalize(growth.revenueGrowth, benchmarks.revenue_growth * 100); // growth viene en 0.10, benchmark tb? Ajustar escala si es necesario
    const s_inc = normalize(growth.netIncomeGrowth, benchmarks.revenue_growth * 100); 
    const scoreGrowth = (s_rev + s_inc) / 2;

    // 2. PROFITABILITY (20%) - ROE, Net Margin
    const s_roe = normalize(ratios.returnOnEquityTTM, benchmarks.roe);
    const s_margin = normalize(ratios.netProfitMarginTTM, benchmarks.net_margin);
    const scoreProfitability = (s_roe + s_margin) / 2;

    // 3. EFFICIENCY (20%) - Asset Turnover, Receivables Turnover (proxies)
    // Usamos ROIC como proxy de eficiencia de capital + Asset Turnover
    const s_roic = normalize(metrics.roicTTM, benchmarks.roe); // comparamos ROIC vs ROE target como proxy
    const s_asset_turn = normalize(ratios.assetTurnoverTTM, 0.8); // 0.8 como base general
    const scoreEfficiency = (s_roic + s_asset_turn) / 2;

    // 4. SOLVENCY (15%) - Debt/Eq, Interest Cov
    const s_debt = normalize(ratios.debtEquityRatioTTM, benchmarks.debt_to_equity, false); // Lower is better
    const s_int = normalize(ratios.interestCoverageTTM, 5); // Target 5x
    const scoreSolvency = (s_debt + s_int) / 2;

    // 5. MOAT (15%) - Gross Margin (pricing power), FCF Margin
    const s_gross = normalize(ratios.grossProfitMarginTTM, 0.40); // 40% GM target genérico de buen moat
    const s_fcf = normalize(metrics.freeCashFlowYieldTTM, 0.05); // 5% yield
    const scoreMoat = (s_gross + s_fcf) / 2;

    // 6. SENTIMENT (10%) - Price vs SMA (Momentum)
    const price = quote.price || 0;
    const sma200 = quote.priceAvg200 || price;
    const s_mom = normalize(price, sma200); // Si precio > sma200 -> >50
    const scoreSentiment = s_mom;

    // FINAL CALC
    const finalScore = 
      (scoreGrowth * WEIGHTS.growth) +
      (scoreProfitability * WEIGHTS.profitability) +
      (scoreEfficiency * WEIGHTS.efficiency) +
      (scoreSolvency * WEIGHTS.solvency) +
      (scoreMoat * WEIGHTS.moat) +
      (scoreSentiment * WEIGHTS.sentiment);

    // Breakdown
    const breakdown: FgosBreakdown = {
      growth: Math.round(scoreGrowth),
      profitability: Math.round(scoreProfitability),
      efficiency: Math.round(scoreEfficiency),
      solvency: Math.round(scoreSolvency),
      moat: Math.round(scoreMoat),
      sentiment: Math.round(scoreSentiment)
    };

    // Verdict
    let verdict = 'Fair';
    if (finalScore > 70) verdict = 'Undervalued / Strong Buy'; // Score alto = bueno
    else if (finalScore < 40) verdict = 'Overvalued / Weak';

    return {
      ticker: ticker.toUpperCase(),
      fgos_score: Math.round(finalScore),
      fgos_breakdown: breakdown,
      valuation_status: verdict,
      ecosystem_score: Math.round(finalScore * 0.9), // Placeholder logic
      calculated_at: new Date().toISOString(),
      price: price
    };

  } catch (error) {
    console.error(`FGOS Error ${ticker}:`, error);
    return null;
  }
}
