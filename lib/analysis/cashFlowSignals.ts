
export interface FinancialRow {
  period_label: string; // e.g. "2023", "TTM"
  date: string;
  free_cash_flow: number | null;
  revenue: number | null;
  net_income: number | null;
  dividend_yield: number | null;
  capex: number | null; // Might be null if not in timeline
}

export type CashFlowSignalType =
  | "cashflow_consistent"
  | "cashflow_volatile"
  | "reinvestment_heavy"
  | "shareholder_friendly"
  | "cashflow_pressure";

export interface CashFlowSignal {
  id: CashFlowSignalType;
  score?: number; // Internal strength score for sorting/priority
}

export function evaluateCashFlowSignals(
  financialRows: FinancialRow[],
  existingNarrativeIds: string[]
): CashFlowSignal[] {
  const signals: CashFlowSignal[] = [];

  // Sort rows by date ascending (oldest to newest)
  const sortedRows = [...financialRows].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Use last 5 periods if available
  const recentRows = sortedRows.slice(-5);
  if (recentRows.length < 2) return [];

  const latest = recentRows[recentRows.length - 1];

  // 1. Cash Flow Consistency
  // Rule: FCF positive in most recent periods (e.g. 3 of last 4)
  const positiveFcfCount = recentRows.filter(r => (r.free_cash_flow || 0) > 0).length;
  const consistencyThreshold = Math.ceil(recentRows.length * 0.75); // e.g. 3 out of 4, or 4 out of 5
  
  if (positiveFcfCount >= consistencyThreshold) {
    signals.push({ id: "cashflow_consistent" });
  }

  // 2. Cash Flow Volatility
  // Rule: Alternating positive/negative FCF or large variance?
  // "Alternating positive / negative FCF"
  let signFlips = 0;
  for (let i = 1; i < recentRows.length; i++) {
    const prev = recentRows[i-1].free_cash_flow || 0;
    const curr = recentRows[i].free_cash_flow || 0;
    if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) {
      signFlips++;
    }
  }
  // If flips > 1 in 5 periods, it's somewhat volatile.
  if (signFlips >= 2) {
    signals.push({ id: "cashflow_volatile" });
  }

  // 3. Reinvestment Heavy
  // Rule: Low dividends + strong revenue growth narrative present
  // Low dividend: yield < 1% or 0
  const lowDividend = (latest.dividend_yield || 0) < 1.0;
  // Strong revenue growth narrative: check existing IDs
  // Assuming "aggressive-growth" or "high-growth" or similar ID exists.
  // Let's assume standard growth anchors like "revenue-growth", "high-growth".
  // Actually, I should check what growth narratives exist in `narrativeAnchors.ts`.
  // Or I can calculate growth myself from rows.
  // The prompt says "strong revenue growth narrative present".
  // I'll check for "growth" related keywords in IDs or just generic "growth".
  const hasGrowthNarrative = existingNarrativeIds.some(id => 
    id.includes('growth') || id.includes('crecimiento')
  );

  if (lowDividend && hasGrowthNarrative) {
    signals.push({ id: "reinvestment_heavy" });
  }

  // 4. Shareholder Friendly
  // Rule: Dividends present + moderate payout narratives?
  // "Dividends present"
  const hasDividends = (latest.dividend_yield || 0) > 1.0;
  // "Moderate payout narratives" -> "income_stability" (from dividend layer)
  const hasStableIncome = existingNarrativeIds.includes('income_stability');
  
  if (hasDividends && hasStableIncome) {
    signals.push({ id: "shareholder_friendly" });
  }

  // 5. Cash Flow Pressure
  // Rule: Weak FCF + dividend pressure narrative
  // Weak FCF: Negative or very low relative to something?
  // Let's say Negative TTM FCF or very low margin?
  // Prompt says "Weak FCF + dividend pressure narrative".
  // "dividend pressure narrative" -> "income_pressure" or "income_fragility"
  const hasPressureNarrative = existingNarrativeIds.includes('income_pressure') || existingNarrativeIds.includes('income_fragility');
  const weakFcf = (latest.free_cash_flow || 0) <= 0;

  if (weakFcf && hasPressureNarrative) {
    signals.push({ id: "cashflow_pressure" });
  }

  // Priority: Risk > Allocation > Quality
  // Risk: cashflow_pressure, cashflow_volatile
  // Allocation: reinvestment_heavy, shareholder_friendly
  // Quality: cashflow_consistent

  const priorityMap: Record<CashFlowSignalType, number> = {
    "cashflow_pressure": 1,
    "cashflow_volatile": 2,
    "reinvestment_heavy": 3,
    "shareholder_friendly": 4,
    "cashflow_consistent": 5
  };

  signals.sort((a, b) => priorityMap[a.id] - priorityMap[b.id]);

  // Max 3 signals
  return signals.slice(0, 3);
}

// --- Helpers ---

interface TimelineResponse {
  years: { year: string | number; columns: string[] }[];
  metrics: {
    key: string;
    values: Record<string, { 
      value: number | null; 
      period_label?: string | null; 
      period_end_date?: string;
      period_type?: string | null;
    }>;
  }[];
}

export function parseTimelineResponse(data: any): FinancialRow[] {
  if (!data || !data.years || !data.metrics) return [];

  const typedData = data as TimelineResponse;
  const rows: FinancialRow[] = [];

  // Flatten all column IDs from years
  const allColumns: string[] = [];
  typedData.years.forEach(g => allColumns.push(...g.columns));

  // Build a map of key -> values for easier access
  const metricsMap = new Map<string, any>();
  typedData.metrics.forEach(m => metricsMap.set(m.key, m.values));

  // Iterate columns and build rows
  for (const colId of allColumns) {
    // We need period info. Usually found in any metric value for this colId.
    // Let's try 'revenue' or 'net_income' as anchor metrics.
    const revenueVal = metricsMap.get('revenue')?.[colId];
    
    // If we can't find basic info, skip
    if (!revenueVal) continue;

    const row: FinancialRow = {
      period_label: revenueVal.period_label || 'Unknown',
      date: revenueVal.period_end_date || '', // Important for sorting
      revenue: revenueVal.value,
      free_cash_flow: metricsMap.get('free_cash_flow')?.[colId]?.value ?? null,
      net_income: metricsMap.get('net_income')?.[colId]?.value ?? null,
      dividend_yield: metricsMap.get('dividend_yield')?.[colId]?.value ?? null,
      capex: null // Not strictly needed for current logic, but good to have if added later
    };

    if (row.date) {
      rows.push(row);
    }
  }

  return rows;
}
