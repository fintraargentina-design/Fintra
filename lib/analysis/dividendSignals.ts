
// lib/analysis/dividendSignals.ts

export type DividendSignalTone = 'positive' | 'neutral' | 'warning' | 'negative';

export type DividendSignal = {
  id: string;
  tone: DividendSignalTone;
  category: 'quality' | 'growth' | 'risk';
  message: string;
};

// Input row type matching the database table 'datos_dividendos'
export interface DividendDividendRow {
  year: number;
  dividend_per_share: number | null;
  dividend_yield: number | null;
  payout_eps: number | null;
  payout_fcf: number | null;
  payments_count: number | null;
  is_growing: boolean | null;
  is_stable: boolean | null;
}

/**
 * Evaluates dividend signals based on historical data.
 * Pure, deterministic, and null-safe.
 */
export function evaluateDividendSignals(
  rows: DividendDividendRow[]
): DividendSignal[] {
  if (!rows || rows.length === 0) return [];

  // Ensure rows are sorted by year ascending for consistent processing
  // (Caller is expected to provide sorted rows, but we can be safe or just assume)
  // The requirement says "ordered by year ascending". We assume this is true.
  
  const signals: DividendSignal[] = [];
  const count = rows.length;
  const latest = rows[count - 1]; // Last row is the latest year

  // Helper to safely get number
  const getVal = (v: number | null) => (v === null ? 0 : v);

  // ------------------------------------------------------------------
  // 1. Dividend Consistent (Quality)
  // Trigger: is_stable === true AND at least 3 years of data
  // ------------------------------------------------------------------
  if (latest.is_stable === true && count >= 3) {
    signals.push({
      id: 'dividend_consistent',
      tone: 'positive',
      category: 'quality',
      message: 'Dividend payments show consistent historical pattern',
    });
  }

  // ------------------------------------------------------------------
  // 2. Dividend Growing (Growth)
  // Trigger: is_growing === true AND latest DPS > average DPS of previous 3 years
  // ------------------------------------------------------------------
  if (latest.is_growing === true && count >= 2) {
    // Need at least 1 previous year to compare, but prompt says "average of previous 3 years".
    // If fewer than 3 previous years exist, we take average of available previous years.
    // "latest dividend_per_share > average dividend_per_share of previous 3 years"
    
    // Previous years: rows[count-2], rows[count-3], rows[count-4]
    const previousRows = [];
    if (count >= 2) previousRows.push(rows[count - 2]);
    if (count >= 3) previousRows.push(rows[count - 3]);
    if (count >= 4) previousRows.push(rows[count - 4]);

    if (previousRows.length > 0) {
      const sum = previousRows.reduce((acc, r) => acc + getVal(r.dividend_per_share), 0);
      const avg = sum / previousRows.length;
      const latestDps = getVal(latest.dividend_per_share);

      if (latestDps > avg) {
        signals.push({
          id: 'dividend_growing',
          tone: 'positive',
          category: 'growth',
          message: 'Dividend per share shows upward trend',
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Payout EPS Stressed (Risk)
  // Trigger: payout_eps > 80
  // ------------------------------------------------------------------
  const payoutEps = latest.payout_eps;
  if (payoutEps !== null && payoutEps > 80) {
    signals.push({
      id: 'payout_eps_stressed',
      tone: 'warning',
      category: 'risk',
      message: 'High earnings payout limits reinvestment capacity',
    });
  }

  // ------------------------------------------------------------------
  // 4. Payout FCF Stressed (Risk)
  // Trigger: payout_fcf > 90
  // ------------------------------------------------------------------
  const payoutFcf = latest.payout_fcf;
  if (payoutFcf !== null && payoutFcf > 90) {
    signals.push({
      id: 'payout_fcf_stressed',
      tone: 'warning',
      category: 'risk',
      message: 'Dividend heavily dependent on free cash flow',
    });
  }

  // ------------------------------------------------------------------
  // 5. Dividend Fragile (Risk - Negative)
  // Trigger: (payout_eps > 80 OR payout_fcf > 90) AND (is_growing === false OR is_stable === false)
  // ------------------------------------------------------------------
  const isHighPayout = (payoutEps !== null && payoutEps > 80) || (payoutFcf !== null && payoutFcf > 90);
  const isWeakTrend = latest.is_growing === false || latest.is_stable === false;
  
  if (isHighPayout && isWeakTrend) {
    signals.push({
      id: 'dividend_fragile',
      tone: 'negative',
      category: 'risk',
      message: 'Dividend sustainability appears fragile',
    });
  }

  // ------------------------------------------------------------------
  // Filter and Sort
  // Limit max 3 signals
  // Prioritize Risk > Growth > Quality
  // ------------------------------------------------------------------
  
  const categoryPriority: Record<string, number> = {
    'risk': 1,
    'growth': 2,
    'quality': 3,
  };

  return signals
    .sort((a, b) => {
      const pA = categoryPriority[a.category] || 99;
      const pB = categoryPriority[b.category] || 99;
      return pA - pB;
    })
    .slice(0, 3);
}
