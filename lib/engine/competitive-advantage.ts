export type CompetitiveAdvantageBand = 'weak' | 'defendable' | 'strong';

export interface CompetitiveAdvantageHistoryRow {
  period_end_date: string;
  period_type?: 'FY' | 'Q' | 'TTM' | null;
  roic?: number | null;
  roe?: number | null;
  operating_margin?: number | null;
  net_margin?: number | null;
  revenue?: number | null;
  invested_capital?: number | null;
  free_cash_flow?: number | null;
  capex?: number | null;
  weighted_shares_out?: number | null;
}

export interface CompetitiveAdvantageAxes {
  return_persistence: number | null;
  operating_stability: number | null;
  capital_discipline: number | null;
}

export interface CompetitiveAdvantageResult {
  score: number | null;
  band: CompetitiveAdvantageBand | null;
  confidence: number;
  axes: CompetitiveAdvantageAxes;
  years_analyzed: number;
}

function clampScore(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (m == null) return null;
  const variance = values.reduce((acc, v) => acc + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function pickReturn(row: CompetitiveAdvantageHistoryRow): number | null {
  if (row.roic != null) return row.roic;
  if (row.roe != null) return row.roe;
  return null;
}

function computeReturnPersistenceAxis(rows: CompetitiveAdvantageHistoryRow[]): { score: number | null; years: number } {
  const fyRows = rows
    .filter(r => !r.period_type || r.period_type === 'FY')
    .slice()
    .sort((a, b) => new Date(a.period_end_date).getTime() - new Date(b.period_end_date).getTime());

  const returns: number[] = [];
  for (const row of fyRows) {
    const r = pickReturn(row);
    if (r != null) returns.push(r);
  }

  const years = returns.length;
  if (years === 0) {
    return { score: null, years: 0 };
  }

  const meanReturn = mean(returns);
  const sdReturn = stdDev(returns);

  let levelScore = 0;
  if (meanReturn != null) {
    const pct = meanReturn * 100;
    if (pct <= 0) {
      levelScore = 0;
    } else if (pct <= 10) {
      levelScore = pct * 4;
    } else if (pct <= 20) {
      levelScore = 40 + (pct - 10) * 2;
    } else if (pct <= 40) {
      levelScore = 60 + (pct - 20);
    } else {
      levelScore = 80 + (pct - 40) * 0.5;
    }
  }
  levelScore = clampScore(levelScore);

  let stabilityScore = 0;
  if (sdReturn != null) {
    const sdPct = sdReturn * 100;
    stabilityScore = clampScore(100 - sdPct * 2);
  }

  let failures = 0;
  const threshold = 0.05;
  for (const r of returns) {
    if (r < threshold) failures += 1;
  }

  const failureRate = years > 0 ? failures / years : 0;
  const failurePenalty = clampScore(failureRate * 100);

  const rawAxis = 0.30 * levelScore + 0.45 * stabilityScore - 0.25 * failurePenalty;
  const axisScore = clampScore(rawAxis);

  return { score: axisScore, years };
}

function computeOperatingStabilityAxis(rows: CompetitiveAdvantageHistoryRow[]): { score: number | null; years: number } {
  const fyRows = rows
    .filter(r => !r.period_type || r.period_type === 'FY')
    .slice()
    .sort((a, b) => new Date(a.period_end_date).getTime() - new Date(b.period_end_date).getTime());

  const margins: number[] = [];
  for (const row of fyRows) {
    const m = row.operating_margin != null ? row.operating_margin : row.net_margin != null ? row.net_margin : null;
    if (m != null) margins.push(m);
  }

  const years = margins.length;
  if (years < 2) {
    return { score: null, years };
  }

  const sdMargin = stdDev(margins);
  let marginStabilityScore = 0;
  if (sdMargin != null) {
    const sdPct = sdMargin * 100;
    marginStabilityScore = clampScore(100 - sdPct * 2);
  }

  let goodEpisodes = 0;
  let badEpisodes = 0;

  for (let i = 1; i < fyRows.length; i += 1) {
    const prev = fyRows[i - 1];
    const curr = fyRows[i];

    const prevMargin = prev.operating_margin != null ? prev.operating_margin : prev.net_margin != null ? prev.net_margin : null;
    const currMargin = curr.operating_margin != null ? curr.operating_margin : curr.net_margin != null ? curr.net_margin : null;
    const prevRevenue = prev.revenue;
    const currRevenue = curr.revenue;

    if (prevMargin == null || currMargin == null || prevRevenue == null || currRevenue == null || prevRevenue === 0) {
      continue;
    }

    const growth = (currRevenue - prevRevenue) / Math.abs(prevRevenue);
    const marginChange = currMargin - prevMargin;

    if (growth >= 0.05) {
      if (marginChange <= -0.01) {
        badEpisodes += 1;
      } else {
        goodEpisodes += 1;
      }
    }
  }

  let coherenceScore: number | null = null;
  const totalEpisodes = goodEpisodes + badEpisodes;
  if (totalEpisodes > 0) {
    const badRatio = badEpisodes / totalEpisodes;
    coherenceScore = clampScore(100 - badRatio * 100);
  }

  let maxDrawdown = 0;
  let peak = margins[0];
  for (let i = 1; i < margins.length; i += 1) {
    const value = margins[i];
    if (value > peak) {
      peak = value;
    }
    const dd = peak - value;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  }

  const maxDrawdownPct = maxDrawdown * 100;
  const marginDrawdownPenalty = clampScore(maxDrawdownPct * 2);

  const stabilityComponent = marginStabilityScore;
  const coherenceComponent = coherenceScore != null ? coherenceScore : marginStabilityScore;

  const rawAxis = 0.50 * stabilityComponent + 0.30 * coherenceComponent - 0.20 * marginDrawdownPenalty;
  const axisScore = clampScore(rawAxis);

  return { score: axisScore, years };
}

function computeCapitalDisciplineAxis(rows: CompetitiveAdvantageHistoryRow[]): { score: number | null; years: number } {
  const fyRows = rows
    .filter(r => !r.period_type || r.period_type === 'FY')
    .slice()
    .sort((a, b) => new Date(a.period_end_date).getTime() - new Date(b.period_end_date).getTime());

  if (fyRows.length < 2) {
    return { score: null, years: fyRows.length };
  }

  let positiveReinvestmentEvents = 0;
  let negativeReinvestmentEvents = 0;

  const dilutionGrowthRates: number[] = [];
  let dilutionYears = 0;

  const efficiencyDeltas: number[] = [];

  for (let i = 1; i < fyRows.length; i += 1) {
    const prev = fyRows[i - 1];
    const curr = fyRows[i];

    const prevIc = prev.invested_capital;
    const currIc = curr.invested_capital;
    const prevRet = pickReturn(prev);
    const currRet = pickReturn(curr);

    if (prevIc != null && currIc != null && prevIc !== 0 && prevRet != null && currRet != null) {
      const icGrowth = (currIc - prevIc) / Math.abs(prevIc);
      if (icGrowth > 0.05) {
        if (currRet >= prevRet - 0.01) {
          positiveReinvestmentEvents += 1;
        } else {
          negativeReinvestmentEvents += 1;
        }
      }
    }

    const prevShares = prev.weighted_shares_out;
    const currShares = curr.weighted_shares_out;
    if (prevShares != null && currShares != null && prevShares > 0) {
      const shareGrowth = (currShares - prevShares) / prevShares;
      if (shareGrowth > 0.01) {
        dilutionGrowthRates.push(shareGrowth);
        dilutionYears += 1;
      }
    }

    const prevRevenue = prev.revenue;
    const currRevenue = curr.revenue;
    if (prevRevenue != null && currRevenue != null && prevRevenue !== 0 && prevIc != null && currIc != null && prevIc !== 0) {
      const revGrowth = (currRevenue - prevRevenue) / Math.abs(prevRevenue);
      const icGrowth = (currIc - prevIc) / Math.abs(prevIc);
      const delta = revGrowth - icGrowth;
      efficiencyDeltas.push(delta);
    }
  }

  let reinvestmentScore: number | null = null;
  const reinvestmentEvents = positiveReinvestmentEvents + negativeReinvestmentEvents;
  if (reinvestmentEvents > 0) {
    const ratio = positiveReinvestmentEvents / reinvestmentEvents;
    reinvestmentScore = clampScore(ratio * 100);
  }

  let dilutionPenalty = 0;
  if (dilutionGrowthRates.length > 0) {
    const cumulativeDilution = dilutionGrowthRates.reduce((acc, v) => acc + v, 0);
    let penaltyBase = Math.min(1, cumulativeDilution) * 100;
    if (dilutionYears <= 1) {
      penaltyBase *= 0.4;
    }
    dilutionPenalty = clampScore(penaltyBase);
  }

  let capitalEfficiencyScore: number | null = null;
  if (efficiencyDeltas.length > 0) {
    const avgDelta = mean(efficiencyDeltas);
    if (avgDelta != null) {
      const clampedDelta = Math.max(-0.3, Math.min(0.3, avgDelta));
      const base = 50 + clampedDelta * 250;
      capitalEfficiencyScore = clampScore(base);
    }
  }

  if (reinvestmentScore == null && capitalEfficiencyScore == null && dilutionPenalty === 0) {
    return { score: null, years: fyRows.length };
  }

  const reinvestmentComponent = reinvestmentScore != null ? reinvestmentScore : 50;
  const efficiencyComponent = capitalEfficiencyScore != null ? capitalEfficiencyScore : 50;

  const rawAxis = 0.40 * reinvestmentComponent - 0.35 * dilutionPenalty + 0.25 * efficiencyComponent;
  const axisScore = clampScore(rawAxis);

  return { score: axisScore, years: fyRows.length };
}

function computeConfidenceFromYears(years: number): number {
  if (years >= 10) return 90;
  if (years >= 8) return 80;
  if (years >= 5) return 70;
  if (years >= 3) return 50;
  if (years >= 1) return 30;
  return 0;
}

export function calculateCompetitiveAdvantage(history: CompetitiveAdvantageHistoryRow[]): CompetitiveAdvantageResult {
  if (!history.length) {
    return {
      score: null,
      band: null,
      confidence: 0,
      axes: {
        return_persistence: null,
        operating_stability: null,
        capital_discipline: null
      },
      years_analyzed: 0
    };
  }

  const axis1 = computeReturnPersistenceAxis(history);
  const axis2 = computeOperatingStabilityAxis(history);
  const axis3 = computeCapitalDisciplineAxis(history);

  const axesScores: number[] = [];
  const weights: number[] = [];

  if (axis1.score != null) {
    axesScores.push(axis1.score);
    weights.push(0.5);
  }
  if (axis2.score != null) {
    axesScores.push(axis2.score);
    weights.push(0.3);
  }
  if (axis3.score != null) {
    axesScores.push(axis3.score);
    weights.push(0.2);
  }

  let finalScore: number | null = null;
  if (axesScores.length > 0) {
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    const weighted = axesScores.reduce((acc, s, idx) => acc + s * weights[idx], 0);
    let combined = totalWeight > 0 ? weighted / totalWeight : null;
    if (combined != null && axis1.score != null) {
      combined = Math.min(combined, axis1.score + 20);
    }
    finalScore = combined != null ? clampScore(combined) : null;
  }

  const fyRows = history.filter(r => !r.period_type || r.period_type === 'FY');
  const yearsAnalyzed = fyRows.length;
  const confidence = computeConfidenceFromYears(yearsAnalyzed);

  let band: CompetitiveAdvantageBand | null = null;
  if (finalScore != null) {
    if (finalScore < 40) band = 'weak';
    else if (finalScore < 70) band = 'defendable';
    else band = 'strong';
  }

  return {
    score: finalScore,
    band,
    confidence,
    axes: {
      return_persistence: axis1.score,
      operating_stability: axis2.score,
      capital_discipline: axis3.score
    },
    years_analyzed: yearsAnalyzed
  };
}

