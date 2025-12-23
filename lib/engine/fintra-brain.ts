import 'server-only';
import { fmpGet } from '@/lib/fmp/server';
import { FMPCompanyProfile, FMPFinancialRatio, FMPKeyMetrics, FMPIncomeStatementGrowth } from '@/lib/fmp/types';
import { FintraSnapshot, FintraScoreBreakdown } from './types';
import { getBenchmarks } from './benchmarks';

/**
 * Normalizes a score between 0 and 100.
 * Formula: (Metric / Benchmark) * 50
 * If higher is better: clamp((val / bench) * 50, 0, 100)
 * If lower is better (e.g. Debt/Equity): clamp((bench / val) * 50, 0, 100)
 */
function scoreMetric(value: number | null | undefined, benchmark: number, lowerIsBetter = false): number {
  if (value === null || value === undefined) return 50; // Neutral score for missing data
  if (benchmark === 0) return 50; // Avoid division by zero

  let rawScore: number;
  if (lowerIsBetter) {
    // Avoid division by zero if value is 0 (perfect score for debt)
    if (value === 0) return 100;
    rawScore = (benchmark / value) * 50;
  } else {
    rawScore = (value / benchmark) * 50;
  }

  return Math.max(0, Math.min(100, rawScore));
}

export async function calculateFGOS(symbol: string): Promise<FintraSnapshot | null> {
  try {
    // 1. Fetch data in parallel
    const [profileData, ratiosData, keyMetricsData, growthData] = await Promise.all([
      fmpGet<FMPCompanyProfile[]>(`v3/profile/${symbol}`),
      fmpGet<FMPFinancialRatio[]>(`v3/ratios-ttm/${symbol}`),
      fmpGet<FMPKeyMetrics[]>(`v3/key-metrics-ttm/${symbol}`),
      fmpGet<FMPIncomeStatementGrowth[]>(`v3/income-statement-growth/${symbol}`, { limit: 1 }),
    ]);

    const profile = profileData?.[0];
    const ratios = ratiosData?.[0];
    const metrics = keyMetricsData?.[0];
    const growth = growthData?.[0];

    if (!profile) {
      console.warn(`[FGOS] No profile found for ${symbol}`);
      return null;
    }

    // 2. Get benchmarks for the sector
    const benchmarks = getBenchmarks(profile.sector);

    // 3. Calculate Component Scores

    // --- Growth (20%) ---
    // Metrics: Revenue Growth, EPS Growth
    const revenueGrowth = growth?.revenueGrowth ?? 0;
    const epsGrowth = growth?.epsgrowth ?? 0;
    
    const scoreRevGrowth = scoreMetric(revenueGrowth, benchmarks.revenueGrowth);
    // Use revenue benchmark for EPS growth as a proxy or define specific if available
    const scoreEpsGrowth = scoreMetric(epsGrowth, benchmarks.revenueGrowth); 

    const growthScore = (scoreRevGrowth + scoreEpsGrowth) / 2;

    // --- Profitability (20%) ---
    // Metrics: Gross Margin, Net Margin
    const grossMargin = ratios?.grossProfitMargin ?? 0;
    const netMargin = ratios?.netProfitMargin ?? 0;

    const scoreGrossMargin = scoreMetric(grossMargin, benchmarks.grossMargin);
    const scoreNetMargin = scoreMetric(netMargin, benchmarks.netMargin);

    const profitabilityScore = (scoreGrossMargin + scoreNetMargin) / 2;

    // --- Efficiency (20%) ---
    // Metrics: ROIC
    const roic = ratios?.returnOnCapitalEmployed ?? 0;
    const scoreRoic = scoreMetric(roic, benchmarks.roic);
    
    // Asset Turnover (Revenue / Total Assets) - not directly in simple ratios sometimes, 
    // but let's assume we use ROIC as the main driver for now or try to derive it.
    // For simplicity in this MVP, we'll weigh ROIC heavily.
    const efficiencyScore = scoreRoic; 

    // --- Solvency (15%) ---
    // Metrics: Current Ratio, Debt/Equity
    const currentRatio = ratios?.currentRatio ?? 0;
    const debtToEquity = ratios?.debtEquityRatio ?? 0;

    // Benchmark for Current Ratio usually > 1.5 or 2
    const scoreCurrentRatio = scoreMetric(currentRatio, 1.5); 
    const scoreDebtToEquity = scoreMetric(debtToEquity, benchmarks.debtToEquity, true); // Lower is better

    const solvencyScore = (scoreCurrentRatio + scoreDebtToEquity) / 2;

    // --- Moat (15%) ---
    // Hard to calculate quantitatively without historical stability.
    // Proxy: High Gross Margin and High ROIC usually indicate a moat.
    const moatScore = (scoreGrossMargin + scoreRoic) / 2;

    // --- Sentiment (10%) ---
    // Proxy: Price vs 50/200 day moving average or just a placeholder 50 for now.
    // We don't have direct sentiment data in the types yet.
    const sentimentScore = 50; 

    // 4. Weighted Final Score
    // Weights: Growth (20%), Profitability (20%), Efficiency (20%), Solvency (15%), Moat (15%), Sentiment (10%)
    const finalScore = 
      (growthScore * 0.20) +
      (profitabilityScore * 0.20) +
      (efficiencyScore * 0.20) +
      (solvencyScore * 0.15) +
      (moatScore * 0.15) +
      (sentimentScore * 0.10);

    // 5. Valuation Status
    const pe = ratios?.priceEarningsRatio ?? 0;
    let valuationStatus: 'Undervalued' | 'Fair' | 'Overvalued' = 'Fair';
    
    // Simple valuation logic relative to sector PE
    if (pe > 0) {
      if (pe < benchmarks.peRatio * 0.8) valuationStatus = 'Undervalued';
      else if (pe > benchmarks.peRatio * 1.2) valuationStatus = 'Overvalued';
    }

    // 6. Construct Breakdown
    const breakdown: FintraScoreBreakdown = {
      growth: {
        score: Math.round(growthScore),
        metrics: { revenueGrowth, epsGrowth }
      },
      profitability: {
        score: Math.round(profitabilityScore),
        metrics: { grossMargin, netMargin }
      },
      efficiency: {
        score: Math.round(efficiencyScore),
        metrics: { roic, assetTurnover: null }
      },
      solvency: {
        score: Math.round(solvencyScore),
        metrics: { currentRatio, debtToEquity }
      },
      moat: {
        score: Math.round(moatScore),
        metrics: { grossMarginStability: null, roicStability: null }
      },
      sentiment: {
        score: Math.round(sentimentScore),
        metrics: { analystRatings: null, newsSentiment: null }
      }
    };

    return {
      symbol: profile.symbol,
      date: new Date().toISOString().split('T')[0],
      fgos_score: Math.round(finalScore),
      fgos_breakdown: breakdown,
      valuation_status: valuationStatus,
      ecosystem_score: Math.round(finalScore), // Using FGOS as ecosystem score for now
    };

  } catch (error) {
    console.error(`[FGOS] Error calculating for ${symbol}:`, error);
    return null;
  }
}
