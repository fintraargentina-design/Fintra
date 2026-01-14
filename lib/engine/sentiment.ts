
import { FgosBreakdown } from './types';

export interface SentimentSignals {
  relative_momentum: number | null;
  consistency_penalty: number | null;
}

export interface SentimentResult {
  value: number | null;
  confidence: number | null;
  status: 'computed' | 'partial' | 'pending';
  signals: SentimentSignals;
}

export interface PerformanceRow {
  window_code: string;
  return_percent: number;
}

/**
 * Calculates the Sentiment dimension for FGOS.
 * 
 * Rules:
 * 1. Data Sources: 1M, 3M, 6M, 1Y, 3Y, 5Y from datos_performance.
 * 2. Signals:
 *    A) Relative Momentum (70%): (ShortTermAvg - LongTermAvg). Clamped [-50, 50].
 *       ShortTerm: Avg(1M, 3M, 6M)
 *       LongTerm: Avg(3Y, 5Y)
 *    B) Consistency Penalty (30%): StdDev(1M, 3M, 6M).
 * 3. Status:
 *    - >= 3Y history (has 3Y or 5Y data) -> 'computed' (Conf: 40)
 *    - 1-3Y history (has 1Y but no 3Y/5Y) -> 'partial' (Conf: 25)
 *    - < 1Y history -> 'pending' (Value: null, Conf: null)
 */
export function calculateSentiment(
  performanceRows: PerformanceRow[]
): SentimentResult {
  // Map rows to a dictionary for easy access
  const perfMap: Record<string, number> = {};
  performanceRows.forEach(row => {
    if (row.return_percent !== null && row.return_percent !== undefined) {
      perfMap[row.window_code] = row.return_percent;
    }
  });

  // Check data availability
  const has1M = perfMap['1M'] !== undefined;
  const has3M = perfMap['3M'] !== undefined;
  const has6M = perfMap['6M'] !== undefined;
  const has1Y = perfMap['1Y'] !== undefined;
  const has3Y = perfMap['3Y'] !== undefined;
  const has5Y = perfMap['5Y'] !== undefined;

  // Determine Status
  let status: 'computed' | 'partial' | 'pending' = 'pending';
  if (has3Y || has5Y) {
    status = 'computed';
  } else if (has1Y) {
    status = 'partial';
  } else {
    status = 'pending';
  }

  // If pending, return nulls (Strict Pending Policy)
  if (status === 'pending') {
    return {
      value: null,
      confidence: null,
      status: 'pending',
      signals: {
        relative_momentum: null,
        consistency_penalty: null
      }
    };
  }

  // --- Signal A: Relative Momentum (70%) ---
  // Short Term Avg (1M, 3M, 6M)
  // If some are missing, average the available ones. 
  // Requirement says "ShortTermAvg = average(1M, 3M, 6M)". 
  // We assume if status is not pending, we have at least 1Y, so we likely have short term data.
  // But strict interpretation: use what's available? 
  // User says "derived from prices_daily", so usually if we have 1Y we have 1M, 3M, 6M.
  const shortTermValues = [perfMap['1M'], perfMap['3M'], perfMap['6M']].filter(v => v !== undefined);
  const shortTermAvg = shortTermValues.length > 0 
    ? shortTermValues.reduce((a, b) => a + b, 0) / shortTermValues.length 
    : 0;

  // Long Term Avg (3Y, 5Y)
  // If status is partial (no 3Y/5Y), what do we do?
  // User definition: "Relative Momentum = short_term_avg - long_term_avg".
  // If long_term_avg is missing (partial status), we can't compute relative momentum exactly as defined.
  // However, the user says "1-3Y history -> status = partial".
  // If partial, maybe we compare against 0 or just use short term? 
  // Or maybe we treat LongTermAvg as 0? 
  // Let's look at "Interpretation: > 0 -> market re-rating".
  // If we lack long term history, we can't measure re-rating vs long term.
  // But we must return a score for 'partial'.
  // Decision: For 'partial' status, we might only use ShortTermAvg (momentum vs 0) or treat LongTermAvg as 0.
  // Let's use LongTermAvg = 0 if missing.
  const longTermValues = [perfMap['3Y'], perfMap['5Y']].filter(v => v !== undefined);
  const longTermAvg = longTermValues.length > 0
    ? longTermValues.reduce((a, b) => a + b, 0) / longTermValues.length
    : 0; // Fallback for partial status

  let relative_momentum_raw = shortTermAvg - longTermAvg;

  // Clamp to [-50%, +50%]
  const MOMENTUM_CLAMP = 50;
  let relative_momentum_clamped = Math.max(-MOMENTUM_CLAMP, Math.min(MOMENTUM_CLAMP, relative_momentum_raw));

  // Normalize to 0-100
  // Range [-50, 50] -> [0, 100]
  // -50 -> 0, 0 -> 50, +50 -> 100
  // Formula: (value + 50) * (100 / 100) = value + 50
  const normalized_momentum = relative_momentum_clamped + MOMENTUM_CLAMP;


  // --- Signal B: Consistency Penalty (30%) ---
  // StdDev(1M, 3M, 6M)
  // Higher dispersion = lower conviction = penalty.
  // If fewer than 2 values, stddev is 0 (or undefined).
  let stdDev = 0;
  if (shortTermValues.length >= 2) {
    const mean = shortTermValues.reduce((a, b) => a + b, 0) / shortTermValues.length;
    const variance = shortTermValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / shortTermValues.length;
    stdDev = Math.sqrt(variance);
  }

  // Normalize Consistency
  // How to map StdDev to 0-100?
  // "Higher dispersion = lower conviction = penalty"
  // So we want a "Consistency Score" where High StdDev -> Low Score.
  // Let's assume a reasonable max StdDev for penalty. 
  // If stocks move +/- 20% in a month, that's high volatility.
  // Let's clamp StdDev at 30%?
  // User didn't specify clamp for consistency, just "Normalize... to 0-100 scale".
  // Let's assume 0 stddev = 100 score (perfect consistency).
  // 30 stddev = 0 score.
  const MAX_STD_DEV = 30;
  const stdDevClamped = Math.min(MAX_STD_DEV, stdDev);
  const normalized_consistency = 100 - (stdDevClamped / MAX_STD_DEV * 100);

  // --- Final Score ---
  // 0.7 * Momentum + 0.3 * Consistency
  let sentiment_score = (0.7 * normalized_momentum) + (0.3 * normalized_consistency);
  
  // Clamp final score to [0, 100]
  sentiment_score = Math.max(0, Math.min(100, sentiment_score));

  // --- Confidence ---
  // computed -> 40
  // partial -> 25
  const confidence = status === 'computed' ? 40 : 25;

  return {
    value: Math.round(sentiment_score),
    confidence,
    status,
    signals: {
      relative_momentum: relative_momentum_raw,
      consistency_penalty: stdDev
    }
  };
}
