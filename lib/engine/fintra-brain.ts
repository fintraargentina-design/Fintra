import { FintraScoreBreakdown, FintraSnapshot } from './types';
import { getBenchmarksForSector } from './benchmarks';
import { fmp } from '@/lib/fmp/client';

/**
 * Motor de cálculo FGOS (Fintra Growth Opportunity Score)
 * Calcula un puntaje del 0 al 100 basado en 5 pilares fundamentales.
 */

// Helper para normalizar puntajes (0-100)
// Si value >= target, score alto (o bajo si isLowerBetter)
function scoreMetric(value: number | undefined | null, target: number, isLowerBetter = false, maxScore = 20): number {
  if (value === undefined || value === null) return maxScore / 2; // Neutral si no hay datos

  const ratio = isLowerBetter 
    ? (target / (value === 0 ? 0.001 : Math.abs(value))) 
    : (value / target);

  // Logarithmic scaling para suavizar extremos
  let score = Math.min(Math.max(ratio, 0), 2) * (maxScore / 2); // Base linear capada
  
  // Ajuste fino
  if (score > maxScore) score = maxScore;
  
  return score;
}

export async function calculateFGOS(ticker: string): Promise<FintraSnapshot | null> {
  try {
    // 1. Obtener datos crudos necesarios
    // Usamos Promise.allSettled para que no falle todo si uno falla
    const [ratiosRes, metricsRes, growthRes, profileRes, quoteRes] = await Promise.allSettled([
      fmp.ratiosTTM(ticker),
      fmp.keyMetricsTTM(ticker),
      fmp.growth(ticker, { period: 'annual', limit: 1 }),
      fmp.profile(ticker),
      fmp.quote(ticker)
    ]);

    // Extraer datos seguros
    const ratios = ratiosRes.status === 'fulfilled' && Array.isArray(ratiosRes.value) ? ratiosRes.value[0] : {};
    const metrics = metricsRes.status === 'fulfilled' && Array.isArray(metricsRes.value) ? metricsRes.value[0] : {};
    const growth = growthRes.status === 'fulfilled' && Array.isArray(growthRes.value) ? growthRes.value[0] : {};
    const profile = profileRes.status === 'fulfilled' && Array.isArray(profileRes.value) ? profileRes.value[0] : {};
    const quote = quoteRes.status === 'fulfilled' && Array.isArray(quoteRes.value) ? quoteRes.value[0] : {};

    if (!profile || !quote) {
      console.error(`FGOS: No se pudo obtener perfil/quote para ${ticker}`);
      return null;
    }

    const sector = profile.sector || 'General';
    const benchmarks = getBenchmarksForSector(sector);

    // 2. Calcular Pilares

    // --- A. Crecimiento (Growth) ---
    // Benchmark: revenue growth vs sector
    const s_rev_growth = scoreMetric(growth.revenueGrowth, benchmarks.revenue_growth, false, 20);
    const s_ni_growth = scoreMetric(growth.netIncomeGrowth, benchmarks.revenue_growth * 1.2, false, 20); // Exigimos un poco mas
    const s_fcf_growth = scoreMetric(growth.freeCashFlowGrowth, benchmarks.revenue_growth, false, 20); // FCF growth
    
    // Promedio ponderado del pilar Growth
    const growthScore = (s_rev_growth * 0.4) + (s_ni_growth * 0.3) + (s_fcf_growth * 0.3);

    // --- B. Rentabilidad (Profitability) ---
    const s_roe = scoreMetric(ratios.returnOnEquityTTM, benchmarks.roe, false, 20);
    const s_roic = scoreMetric(metrics.roicTTM, benchmarks.roe * 0.8, false, 20); // ROIC suele ser menor que ROE
    const s_net_margin = scoreMetric(ratios.netProfitMarginTTM, benchmarks.net_margin, false, 20);
    const s_fcf_margin = scoreMetric(metrics.freeCashFlowYieldTTM, 0.05, false, 20); // Benchmark fijo 5% yield como bueno

    const profitabilityScore = (s_roe * 0.3) + (s_roic * 0.3) + (s_net_margin * 0.2) + (s_fcf_margin * 0.2);

    // --- C. Salud Financiera (Financial Health) ---
    const s_curr_ratio = scoreMetric(ratios.currentRatioTTM, 1.5, false, 20); // > 1.5 es sólido
    const s_debt_eq = scoreMetric(ratios.debtEquityRatioTTM, benchmarks.debt_to_equity, true, 20); // Menor es mejor
    const s_int_cov = scoreMetric(ratios.interestCoverageTTM, 5, false, 20); // > 5 es seguro
    const s_altman = scoreMetric(metrics.grahamNumberTTM ? 3 : 1.8, 3, false, 20); // Placeholder si no hay Altman Z directo, usamos lógica proxy o default safe

    const healthScore = (s_curr_ratio * 0.25) + (s_debt_eq * 0.25) + (s_int_cov * 0.25) + (s_altman * 0.25);

    // --- D. Valoración (Valuation) ---
    const s_pe = scoreMetric(ratios.priceEarningsRatioTTM, benchmarks.pe_ratio, true, 20); // Menor es mejor
    const s_pfcf = scoreMetric(ratios.priceToFreeCashFlowsRatioTTM, 20, true, 20); // < 20 es decente
    const s_evebitda = scoreMetric(metrics.enterpriseValueOverEBITDATTM, 12, true, 20);
    const s_peg = scoreMetric(ratios.pegRatioTTM, 1.0, true, 20); // < 1 es growth at reasonable price

    const valuationScore = (s_pe * 0.3) + (s_pfcf * 0.3) + (s_evebitda * 0.2) + (s_peg * 0.2);

    // --- E. Momentum / Técnico (Momentum) ---
    // Usamos price vs moving averages como proxy simple
    const price = quote.price || 0;
    const sma50 = quote.priceAvg50 || price;
    const sma200 = quote.priceAvg200 || price;
    
    const s_vs_50 = price > sma50 ? 20 : 10;
    const s_vs_200 = price > sma200 ? 20 : 5;
    // RSI no siempre disponible en quote simple, asumimos neutral si falta
    const s_rsi = 15; // Neutral default

    const momentumScore = (s_vs_50 * 0.4) + (s_vs_200 * 0.4) + (s_rsi * 0.2);


    // 3. Score Final
    // Ponderación de pilares (ajustable según filosofía de inversión)
    // Growth: 20%, Profitability: 25%, Health: 20%, Valuation: 25%, Momentum: 10%
    const totalScore = (
      (growthScore * 1.0) + // Los scores internos ya base 20, así que sumados dan 100 si todos son perfectos
      (profitabilityScore * 1.0) +
      (healthScore * 1.0) +
      (valuationScore * 1.0) +
      (momentumScore * 1.0)
    );

    // Status
    let valuationStatus: 'Undervalued' | 'Fair' | 'Overvalued' | 'N/A' = 'Fair';
    if (valuationScore > 16) valuationStatus = 'Undervalued'; // Score alto en valuation significa barato
    else if (valuationScore < 8) valuationStatus = 'Overvalued';

    const snapshot: FintraSnapshot = {
      ticker: ticker.toUpperCase(),
      calculated_at: new Date().toISOString(),
      overall_score: Math.min(Math.round(totalScore), 100),
      valuation_status: valuationStatus,
      price_at_calculation: price,
      score_breakdown: {
        growth: { 
          score: growthScore, 
          details: { 
            revenue_growth: growth.revenueGrowth || 0,
            net_income_growth: growth.netIncomeGrowth || 0,
            fcf_growth: growth.freeCashFlowGrowth || 0
          }
        },
        profitability: { 
          score: profitabilityScore, 
          details: {
            roe: ratios.returnOnEquityTTM || 0,
            roic: metrics.roicTTM || 0,
            net_margin: ratios.netProfitMarginTTM || 0,
            fcf_margin: metrics.freeCashFlowYieldTTM || 0
          }
        },
        financial_health: { 
          score: healthScore, 
          details: {
            current_ratio: ratios.currentRatioTTM || 0,
            debt_to_equity: ratios.debtEquityRatioTTM || 0,
            interest_coverage: ratios.interestCoverageTTM || 0,
            altman_z: 0 // Placeholder
          }
        },
        valuation: { 
          score: valuationScore, 
          details: {
            pe_ratio: ratios.priceEarningsRatioTTM || 0,
            pfcf_ratio: ratios.priceToFreeCashFlowsRatioTTM || 0,
            ev_ebitda: metrics.enterpriseValueOverEBITDATTM || 0,
            peg_ratio: ratios.pegRatioTTM || 0
          }
        },
        momentum: { 
          score: momentumScore, 
          details: {
            price_vs_50sma: (price / sma50) - 1,
            price_vs_200sma: (price / sma200) - 1,
            rsi: 0,
            relative_strength: 0
          }
        }
      }
    };

    return snapshot;

  } catch (error) {
    console.error('Error calculating FGOS:', error);
    return null;
  }
}
