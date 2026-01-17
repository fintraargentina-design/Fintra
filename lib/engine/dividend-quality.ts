export type DividendQualityBand = 'weak' | 'acceptable' | 'high';

export interface DividendQualityYearRow {
  year: number;
  has_dividend: boolean | null;
  dividend_per_share: number | null;
  dividend_cash_paid: number | null;
  payout_eps: number | null;
  payout_fcf: number | null;
  is_growing: boolean | null;
  net_income: number | null;
  free_cash_flow: number | null;
}

export interface DividendQualityAxes {
  consistency: number | null;
  growth_reliability: number | null;
  payout_sustainability: number | null;
  capital_discipline: number | null;
}

export interface DividendQualityResult {
  score: number | null;
  band: DividendQualityBand | null;
  confidence: number | null;
  axes: DividendQualityAxes;
  years_analyzed: number;
}

function clampScore(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function sortAndSliceHistory(rows: DividendQualityYearRow[]): DividendQualityYearRow[] {
  return rows
    .slice()
    .sort((a, b) => a.year - b.year)
    .slice(-10);
}

function computeConsistencyAxis(rows: DividendQualityYearRow[]): { score: number | null; years: number } {
  const hist = sortAndSliceHistory(rows);
  const years = hist.length;
  if (years === 0) return { score: null, years: 0 };

  let payingYears = 0;
  let gapCount = 0;
  let maxConsecutiveGaps = 0;
  let currentGap = 0;

  for (const row of hist) {
    const paying = row.has_dividend === true && (row.dividend_per_share ?? 0) > 0;
    if (paying) {
      payingYears += 1;
      if (currentGap > 0) {
        gapCount += 1;
        if (currentGap > maxConsecutiveGaps) maxConsecutiveGaps = currentGap;
        currentGap = 0;
      }
    } else {
      currentGap += 1;
    }
  }

  if (currentGap > 0) {
    gapCount += 1;
    if (currentGap > maxConsecutiveGaps) maxConsecutiveGaps = currentGap;
  }

  const payRatio = years > 0 ? payingYears / years : 0;
  let base = payRatio * 100;

  const gapPenalty = Math.min(30, gapCount * 8 + maxConsecutiveGaps * 4);
  const score = clampScore(base - gapPenalty);

  return { score, years };
}

function computeGrowthReliabilityAxis(rows: DividendQualityYearRow[]): { score: number | null; years: number } {
  const hist = sortAndSliceHistory(rows).filter(r => r.dividend_per_share != null && r.dividend_per_share > 0);
  if (hist.length < 2) return { score: null, years: hist.length };

  const growthRates: number[] = [];
  let positiveRuns = 0;
  let negativeOrFlatRuns = 0;

  for (let i = 1; i < hist.length; i += 1) {
    const prev = hist[i - 1].dividend_per_share as number;
    const curr = hist[i].dividend_per_share as number;
    if (prev <= 0) continue;
    const g = (curr - prev) / prev;
    growthRates.push(g);
    if (g > 0.02) positiveRuns += 1;
    else if (g < -0.02) negativeOrFlatRuns += 1;
  }

  if (growthRates.length === 0) return { score: null, years: hist.length };

  const mean = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
  const variance = growthRates.reduce((a, b) => a + (b - mean) * (b - mean), 0) / growthRates.length;
  const sd = Math.sqrt(variance);

  let base = 50;
  if (mean >= 0.0 && mean <= 0.05) base = 70;
  else if (mean > 0.05) base = 80;
  else if (mean < 0) base = 40;

  const volatilityPenalty = Math.min(40, sd * 200);

  let directionPenalty = 0;
  if (negativeOrFlatRuns > 0 && positiveRuns > 0) {
    directionPenalty = 15;
  }

  const score = clampScore(base - volatilityPenalty - directionPenalty);
  return { score, years: hist.length };
}

function scorePayoutRatio(ratio: number | null): number | null {
  if (ratio == null) return null;
  if (ratio <= 0) return 20;
  if (ratio > 150) return 10;
  if (ratio > 100) return 25;
  if (ratio >= 30 && ratio <= 70) return 90;
  if (ratio >= 15 && ratio < 30) return 80;
  if (ratio > 70 && ratio <= 90) return 70;
  return 60;
}

function computePayoutSustainabilityAxis(rows: DividendQualityYearRow[]): { score: number | null; years: number } {
  const hist = sortAndSliceHistory(rows);
  if (hist.length === 0) return { score: null, years: 0 };

  let scores: number[] = [];

  for (const row of hist) {
    const hasDiv = row.has_dividend === true && (row.dividend_per_share ?? 0) > 0;
    if (!hasDiv) continue;

    const yearScores: number[] = [];
    const epsScore = scorePayoutRatio(row.payout_eps);
    const fcfScore = scorePayoutRatio(row.payout_fcf);
    if (epsScore != null) yearScores.push(epsScore);
    if (fcfScore != null) yearScores.push(fcfScore);

    if (yearScores.length === 0) continue;

    let yearScore = yearScores.reduce((a, b) => a + b, 0) / yearScores.length;

    if (row.net_income != null && row.net_income <= 0) {
      yearScore -= 25;
    }
    if (row.free_cash_flow != null && row.free_cash_flow <= 0) {
      yearScore -= 25;
    }

    scores.push(clampScore(yearScore));
  }

  if (!scores.length) return { score: null, years: hist.length };

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  return { score: clampScore(avgScore), years: hist.length };
}

function computeCapitalDisciplineAxis(rows: DividendQualityYearRow[]): { score: number | null; years: number } {
  const hist = sortAndSliceHistory(rows);
  if (hist.length < 2) return { score: null, years: hist.length };

  const perYearScores: number[] = [];

  for (const row of hist) {
    const hasDiv = row.has_dividend === true && (row.dividend_per_share ?? 0) > 0;
    const ni = row.net_income;
    const fcf = row.free_cash_flow;

    if (ni == null || fcf == null) continue;

    let score = 50;

    if (ni < 0 || fcf < 0) {
      if (hasDiv) {
        score = 20;
      } else {
        score = 70;
      }
    } else {
      if (hasDiv) {
        score = 65;
      } else {
        score = 55;
      }
    }

    perYearScores.push(score);
  }

  if (!perYearScores.length) return { score: null, years: hist.length };

  const avg = perYearScores.reduce((a, b) => a + b, 0) / perYearScores.length;
  return { score: clampScore(avg), years: hist.length };
}

function calculateConfidence(axes: DividendQualityAxes, years: number): number | null {
  if (years === 0) return null;

  const axisValues = [axes.consistency, axes.growth_reliability, axes.payout_sustainability, axes.capital_discipline];
  const available = axisValues.filter(v => v != null).length;
  if (available === 0) return 20;

  const coverageFactor = available / axisValues.length;
  const historyFactor = Math.min(1, years / 8);

  const base = 30 + 50 * coverageFactor * historyFactor;
  return clampScore(base);
}

function bandFromScore(score: number | null): DividendQualityBand | null {
  if (score == null) return null;
  if (score >= 70) return 'high';
  if (score >= 45) return 'acceptable';
  return 'weak';
}

export function calculateDividendQuality(rows: DividendQualityYearRow[]): DividendQualityResult {
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return {
      score: null,
      band: null,
      confidence: null,
      axes: {
        consistency: null,
        growth_reliability: null,
        payout_sustainability: null,
        capital_discipline: null
      },
      years_analyzed: 0
    };
  }

  const consistency = computeConsistencyAxis(rows);
  const growth = computeGrowthReliabilityAxis(rows);
  const payout = computePayoutSustainabilityAxis(rows);
  const discipline = computeCapitalDisciplineAxis(rows);

  const axes: DividendQualityAxes = {
    consistency: consistency.score,
    growth_reliability: growth.score,
    payout_sustainability: payout.score,
    capital_discipline: discipline.score
  };

  const yearsAnalyzed = Math.max(consistency.years, growth.years, payout.years, discipline.years);

  const weights = {
    consistency: 0.4,
    payout_sustainability: 0.3,
    growth_reliability: 0.2,
    capital_discipline: 0.1
  } as const;

  const components: { value: number; weight: number }[] = [];

  if (axes.consistency != null) components.push({ value: axes.consistency, weight: weights.consistency });
  if (axes.payout_sustainability != null)
    components.push({ value: axes.payout_sustainability, weight: weights.payout_sustainability });
  if (axes.growth_reliability != null) components.push({ value: axes.growth_reliability, weight: weights.growth_reliability });
  if (axes.capital_discipline != null) components.push({ value: axes.capital_discipline, weight: weights.capital_discipline });

  let finalScore: number | null = null;

  if (components.length > 0) {
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    const weighted = components.reduce((sum, c) => sum + c.value * c.weight, 0);
    finalScore = clampScore(weighted / (totalWeight || 1));
  }

  const confidence = calculateConfidence(axes, yearsAnalyzed);
  const band = bandFromScore(finalScore);

  return {
    score: finalScore,
    band,
    confidence,
    axes,
    years_analyzed: yearsAnalyzed
  };
}

