import { FgosStatus } from "./types";
import { getSectorDefaults } from "./utils/sectorDefaults";

export interface CoherenceCheckInput {
  revenueGrowth: number; // % growth (e.g., 0.25 = 25%)
  operatingMarginChange: number; // Change in percentage points (e.g., -0.01 = -1pp)
  netMarginChange?: number;
}

export interface CoherenceCheckResult {
  score: number; // 0-100
  verdict: "High Quality Growth" | "Neutral" | "Inefficient Growth";
  explanation: string;
  metadata?: {
    revenueGrowth: number;
    marginChange: number;
  };
}

export interface MoatResult {
  score: number | null;
  status: "computed" | "partial" | "pending";
  confidence: number | null;
  coherenceCheck?: CoherenceCheckResult;
  details?: {
    roic_persistence: number;
    margin_stability: number;
    capital_discipline?: number; // NEW: Third pillar (20%)
    years_analyzed: number;
  };
}

export interface FinancialHistoryRow {
  period_end_date: string;
  roic: number | null;
  gross_margin: number | null;
  revenue?: number | null;
  operating_margin?: number | null;
  invested_capital?: number | null; // NEW: For capital discipline calculation
}

/**
 * Coherence Check: Detects if revenue growth comes with pricing power (margins expand)
 * or at the expense of eroding margins (inefficient growth).
 *
 * Examples:
 * - Apple 2010-2020: Revenue +10%, Margin +3pp → High Quality Growth
 * - Amazon Retail 2012-2015: Revenue +25%, Margin -2pp → Inefficient Growth
 */
export function calculateCoherenceCheck(
  input: CoherenceCheckInput,
): CoherenceCheckResult {
  const { revenueGrowth, operatingMarginChange } = input;

  const REVENUE_GROWTH_THRESHOLD = 0.05; // 5%
  const MARGIN_DECLINE_THRESHOLD = -0.01; // -1 percentage point

  // HIGH QUALITY GROWTH: Revenue sube Y margin se mantiene o sube
  if (revenueGrowth > REVENUE_GROWTH_THRESHOLD && operatingMarginChange >= 0) {
    return {
      score: 100,
      verdict: "High Quality Growth",
      explanation:
        "Revenue growth with margin expansion indicates strong pricing power and operational leverage",
      metadata: { revenueGrowth, marginChange: operatingMarginChange },
    };
  }

  // INEFFICIENT GROWTH: Revenue sube pero margin cae significativamente
  if (
    revenueGrowth > REVENUE_GROWTH_THRESHOLD &&
    operatingMarginChange < MARGIN_DECLINE_THRESHOLD
  ) {
    return {
      score: 30,
      verdict: "Inefficient Growth",
      explanation:
        "Revenue growth at expense of margins suggests weak pricing power and competitive pressure",
      metadata: { revenueGrowth, marginChange: operatingMarginChange },
    };
  }

  // NEUTRAL: Crecimiento con presión menor en márgenes
  if (
    revenueGrowth > REVENUE_GROWTH_THRESHOLD &&
    operatingMarginChange < 0 &&
    operatingMarginChange >= MARGIN_DECLINE_THRESHOLD
  ) {
    return {
      score: 70,
      verdict: "Neutral",
      explanation:
        "Revenue growth with minor margin pressure - acceptable if investing for future",
      metadata: { revenueGrowth, marginChange: operatingMarginChange },
    };
  }

  // Sin crecimiento significativo
  return {
    score: 50,
    verdict: "Neutral",
    explanation: "Coherence check not applicable - low revenue growth",
    metadata: { revenueGrowth, marginChange: operatingMarginChange },
  };
}

/**
 * Capital Discipline: Detects if companies create value (capital↑ + ROIC↑)
 * or destroy value (capital↑ + ROIC↓).
 *
 * This addresses a limitation of pure ROIC persistence: a company can maintain
 * high ROIC by refusing to reinvest profits (capital discipline by stagnation),
 * or it can grow capital while keeping ROIC high (true quality growth).
 *
 * Value Creation: Capital grows AND ROIC stays high or improves
 * Value Destruction: Capital grows but ROIC deteriorates (over-expansion)
 *
 * Examples:
 * - AAPL 2010-2020: Capital +120%, ROIC 35%→40% → Excellent (100)
 * - AMZN 2012-2015: Capital +150%, ROIC 12%→6% → Poor (30)
 *
 * @param history - Financial history (at least 3 years)
 * @returns Score 0-100 (100=Excellent discipline, 0=Poor capital allocation)
 */
export function calculateCapitalDiscipline(
  history: FinancialHistoryRow[],
): number | null {
  // Need at least 3 years to detect trend
  if (!history || history.length < 3) return null;

  const sorted = [...history]
    .filter((h) => h.roic != null && h.invested_capital != null)
    .sort(
      (a, b) =>
        new Date(b.period_end_date).getTime() -
        new Date(a.period_end_date).getTime(),
    );

  if (sorted.length < 3) return null;

  const latest = sorted[0];
  const oldest = sorted[sorted.length - 1];

  const capitalGrowth =
    ((latest.invested_capital! - oldest.invested_capital!) /
      oldest.invested_capital!) *
    100;
  const roicChange = (latest.roic! - oldest.roic!) * 100; // Convert to percentage points

  // Scenario 1: EXCELLENT (100) - Capital grows, ROIC improves or stays high
  // Capital +20% or more, ROIC improves by +2pp or more
  if (capitalGrowth > 20 && roicChange > 2) {
    return 100;
  }

  // Scenario 2: GOOD (80) - Capital grows moderately, ROIC stable
  // Capital +10% to +20%, ROIC change between -1pp and +2pp
  if (
    capitalGrowth > 10 &&
    capitalGrowth <= 20 &&
    roicChange >= -1 &&
    roicChange <= 2
  ) {
    return 80;
  }

  // Scenario 3: NEUTRAL (60) - Capital grows slightly, minor ROIC decline
  // Capital +5% to +10%, ROIC decline -1pp to -3pp (acceptable reinvestment)
  if (
    capitalGrowth > 5 &&
    capitalGrowth <= 10 &&
    roicChange >= -3 &&
    roicChange < -1
  ) {
    return 60;
  }

  // Scenario 4: POOR (30) - Aggressive capital growth, ROIC deteriorates
  // Capital +20% or more, ROIC declines -3pp or more (value destruction)
  if (capitalGrowth > 20 && roicChange < -3) {
    return 30;
  }

  // Scenario 5: STAGNATION (50) - Low/no capital growth
  // Capital < +5% (company not reinvesting, playing it too safe)
  if (capitalGrowth <= 5) {
    return 50;
  }

  // Default: Moderate score for edge cases
  return 60;
}

export function calculateMoat(
  history: FinancialHistoryRow[],
  benchmarks: { roic?: { p50: number }; gross_margin?: { p50: number } },
  sector?: string | null,
): MoatResult {
  // 0. Safety check
  if (!history || !Array.isArray(history)) {
    return {
      score: null,
      status: "pending",
      confidence: null,
    };
  }

  // 1. Filter and Sort History (FY only, strict)
  // Assumes history passed is already FY filtered if needed, but we double check or assume caller handles it.
  // We sort descending by date to get latest 5.
  const sorted = [...history]
    .filter((h) => h.roic != null && h.gross_margin != null)
    .sort(
      (a, b) =>
        new Date(b.period_end_date).getTime() -
        new Date(a.period_end_date).getTime(),
    )
    .slice(0, 5); // Max 5 years

  const count = sorted.length;

  // 2. Status Determination
  let status: "computed" | "partial" | "pending" = "pending";
  let confidence: number | null = null;

  if (count >= 5) {
    status = "computed";
    confidence = 80; // 70-85 range
  } else if (count >= 3) {
    status = "partial";
    confidence = 50; // 40-60 range
  } else {
    return {
      score: null,
      status: "pending",
      confidence: null,
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
  const roicVariance =
    roicValues.reduce((a, b) => a + Math.pow(b - roicMean, 2), 0) / count;
  const roicStdDev = Math.sqrt(roicVariance);

  // Penalty: If StdDev > 5% (0.05), penalize.
  // Max penalty 20 points.
  if (roicStdDev > 0.05) {
    const penalty = Math.min(20, (roicStdDev - 0.05) * 100 * 2);
    roicPersistence = Math.max(0, roicPersistence - penalty);
  }

  // 4. Margin Stability (Secondary - 30%)
  const sectorMargin =
    benchmarks.gross_margin?.p50 ?? sectorDefaults.grossMargin;
  const marginValues = sorted.map((r) => r.gross_margin ?? 0);

  const marginMean = marginValues.reduce((a, b) => a + b, 0) / count;
  const marginVariance =
    marginValues.reduce((a, b) => a + Math.pow(b - marginMean, 2), 0) / count;
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
  const stabilityMetric = Math.max(0, 100 - marginStdDev * 200);

  const marginScore = levelScore * 0.5 + stabilityMetric * 0.5;

  // 5. Coherence Check (Revenue Growth vs Margin Change)
  let coherenceCheck: CoherenceCheckResult | undefined;
  let adjustedMarginScore = marginScore;

  if (sorted.length >= 2) {
    const latest = sorted[0];
    const previous = sorted[1];

    // Calculate revenue growth and margin change
    if (
      latest.revenue &&
      previous.revenue &&
      latest.operating_margin != null &&
      previous.operating_margin != null
    ) {
      const revenueGrowth =
        (latest.revenue - previous.revenue) / previous.revenue;
      const marginChange = (latest.operating_margin ?? 0) - (previous.operating_margin ?? 0);

      coherenceCheck = calculateCoherenceCheck({
        revenueGrowth,
        operatingMarginChange: marginChange,
      });

      // Penalizar stability si coherence es malo
      if (coherenceCheck.verdict === "Inefficient Growth") {
        adjustedMarginScore *= 0.6; // Penalización 40%
      }
    }
  }

  // 6. Capital Discipline (NEW - Third Pillar - 20%)
  const capitalDisciplineScore = calculateCapitalDiscipline(sorted);

  // 7. Final Score (NEW WEIGHTS: 50% ROIC + 30% Margin + 20% Capital Discipline)
  let rawScore: number;

  if (capitalDisciplineScore === null) {
    // Fallback if capital data unavailable: OLD 70/30 weighting
    rawScore = 0.7 * roicPersistence + 0.3 * adjustedMarginScore;
  } else {
    // NEW 50/30/20 weighting with all 3 pillars
    rawScore =
      0.5 * roicPersistence +
      0.3 * adjustedMarginScore +
      0.2 * capitalDisciplineScore;
  }

  const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

  return {
    score: finalScore,
    status,
    confidence,
    coherenceCheck,
    details: {
      roic_persistence: roicPersistence,
      margin_stability: adjustedMarginScore,
      capital_discipline: capitalDisciplineScore ?? undefined,
      years_analyzed: count,
    },
  };
}
