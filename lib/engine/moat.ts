import { FgosStatus } from './types';
import { getSectorDefaults } from './utils/sectorDefaults';

export interface MoatResult {
  score: number | null;
  status: 'computed' | 'partial' | 'pending';
  confidence: number | null;
  details?: {
    roic_persistence: number;
    margin_stability: number;
    years_analyzed: number;
  };
}

export interface FinancialHistoryRow {
  period_end_date: string;
  roic: number | null;
  gross_margin: number | null;
}

export function calculateMoat(
  history: FinancialHistoryRow[],
  benchmarks: { roic?: { p50: number }; gross_margin?: { p50: number } },
  sector?: string | null
): MoatResult {
  // 0. Safety check
  if (!history || !Array.isArray(history)) {
    return {
      score: null,
      status: 'pending',
      confidence: null
    };
  }

  // 1. Filter and Sort History (FY only, strict)
  // Assumes history passed is already FY filtered if needed, but we double check or assume caller handles it.
  // We sort descending by date to get latest 5.
  const sorted = [...history]
    .filter(h => h.roic != null && h.gross_margin != null)
    .sort((a, b) => new Date(b.period_end_date).getTime() - new Date(a.period_end_date).getTime())
    .slice(0, 5); // Max 5 years

  const count = sorted.length;

  // 2. Status Determination
  let status: 'computed' | 'partial' | 'pending' = 'pending';
  let confidence: number | null = null;

  if (count >= 5) {
    status = 'computed';
    confidence = 80; // 70-85 range
  } else if (count >= 3) {
    status = 'partial';
    confidence = 50; // 40-60 range
  } else {
    return {
      score: null,
      status: 'pending',
      confidence: null
    };
  }

  // 3. ROIC Persistence (Primary - 70%)
  // Compare vs Sector Median (P50)
  // Use sector-specific defaults if benchmark is missing
  const sectorDefaults = getSectorDefaults(sector);
  const sectorRoic = benchmarks.roic?.p50 ?? sectorDefaults.roic;
  
  let yearsAbove = 0;
  const roicValues: number[] = [];

  for (const row of sorted) {
    if ((row.roic ?? 0) > sectorRoic) {
      yearsAbove++;
    }
    roicValues.push(row.roic ?? 0);
  }

  // Persistence Score: % of years beating sector
  let roicPersistence = (yearsAbove / count) * 100;

  // Volatility Penalty (StdDev)
  const roicMean = roicValues.reduce((a, b) => a + b, 0) / count;
  const roicVariance = roicValues.reduce((a, b) => a + Math.pow(b - roicMean, 2), 0) / count;
  const roicStdDev = Math.sqrt(roicVariance);

  // Penalty: If StdDev > 5% (0.05), penalize. 
  // Max penalty 20 points.
  if (roicStdDev > 0.05) {
    const penalty = Math.min(20, (roicStdDev - 0.05) * 100 * 2); 
    roicPersistence = Math.max(0, roicPersistence - penalty);
  }

  // 4. Margin Stability (Secondary - 30%)
  const sectorMargin = benchmarks.gross_margin?.p50 ?? sectorDefaults.grossMargin;
  const marginValues = sorted.map(r => r.gross_margin ?? 0);
  
  const marginMean = marginValues.reduce((a, b) => a + b, 0) / count;
  const marginVariance = marginValues.reduce((a, b) => a + Math.pow(b - marginMean, 2), 0) / count;
  const marginStdDev = Math.sqrt(marginVariance);

  // Level Score: (Avg / Sector) * 50. Cap at 100.
  // If Avg = Sector, score = 50. If Avg = 2x Sector, score = 100.
  const levelScore = Math.min(100, (marginMean / sectorMargin) * 50);

  // Stability Score: 100 - (CV * 200)? 
  // Or just penalize StdDev.
  // If StdDev = 0 (perfect stability) -> 100.
  // If StdDev = 0.05 (5%) -> 100 - 10 = 90.
  // If StdDev = 0.20 (20%) -> 100 - 40 = 60.
  // Formula: 100 - (StdDev * 200)
  const stabilityMetric = Math.max(0, 100 - (marginStdDev * 200));

  const marginScore = (levelScore * 0.5) + (stabilityMetric * 0.5);

  // 5. Final Score
  const rawScore = (0.7 * roicPersistence) + (0.3 * marginScore);
  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    score: finalScore,
    status,
    confidence,
    details: {
      roic_persistence: roicPersistence,
      margin_stability: marginScore,
      years_analyzed: count
    }
  };
}
