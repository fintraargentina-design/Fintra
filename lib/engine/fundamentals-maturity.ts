
export type MaturityClassification = 'early' | 'developing' | 'established';

export interface FundamentalsMaturityResult {
  fundamentals_years_count: number;
  fundamentals_first_year: number | null;
  fundamentals_last_year: number | null;
  fgos_maturity: MaturityClassification;
}

export function calculateFundamentalsMaturity(
  financialHistory: any[]
): FundamentalsMaturityResult {
  // 1. Filter and Sort
  // We only care about FY records
  // We assume a row in datos_financieros implies existence of Income, Balance, Cashflow
  // because of the strict ingestion logic in deriveFinancialMetrics.ts.
  // However, for extra safety, we ensure key metrics are not null.
  const validYears = financialHistory
    .filter(row => 
      row.period_type === 'FY' &&
      row.revenue !== null &&
      row.net_income !== null && 
      row.free_cash_flow !== null
    )
    .sort((a, b) => new Date(b.period_end_date).getTime() - new Date(a.period_end_date).getTime());

  if (validYears.length === 0) {
    return {
      fundamentals_years_count: 0,
      fundamentals_first_year: null,
      fundamentals_last_year: null,
      fgos_maturity: 'early'
    };
  }

  // 2. Count Consecutive Block (Most Recent)
  let count = 0;
  let lastYearVal = -1;

  // Iterate from most recent
  for (let i = 0; i < validYears.length; i++) {
    const row = validYears[i];
    
    // Parse year from date (period_end_date is YYYY-MM-DD)
    const year = new Date(row.period_end_date).getFullYear();

    if (i === 0) {
      // First one (most recent)
      count = 1;
      lastYearVal = year;
    } else {
      // Check consecutiveness
      // Note: Fiscal years can be weird (e.g. ending in Jan of next year).
      // Ideally we use period_label (e.g. '2023') if available and reliable.
      // But period_label in datos_financieros seems to be the calendar year of the FY.
      // Let's check period_label usage in ingestion.
      // In backfillFinancials.ts: period_label = latestIncome.period (e.g. '2023').
      // In deriveFinancialMetrics.ts: period_label = inc.date.slice(0, 4) or calendarYear.
      
      // Let's try to parse period_label as integer if possible, else fall back to date year.
      let currentFy = parseInt(row.period_label);
      if (isNaN(currentFy)) {
          currentFy = year;
      }
      
      // We need to compare with the previous one in the loop (which is newer in time)
      // Actually, we are iterating DESCENDING (newest first).
      // So validYears[i-1] is the newer one.
      // We need validYears[i] to be exactly 1 year before validYears[i-1].
      
      const prevRow = validYears[i-1];
      let prevFy = parseInt(prevRow.period_label);
      if (isNaN(prevFy)) {
          prevFy = new Date(prevRow.period_end_date).getFullYear();
      }

      // Check gap
      const diff = prevFy - currentFy;

      if (diff === 1) {
        count++;
        lastYearVal = currentFy;
      } else if (diff === 0) {
        // Duplicate year? Skip or treat as same?
        // If multiple rows for same FY (unlikely with upsert key), ignore.
        continue;
      } else {
        // Gap > 1, break the chain
        break;
      }
    }
  }

  // 3. Resolve bounds
  // The block starts at validYears[0] (most recent) and goes back 'count' items.
  // Actually, we stopped counting when chain broke.
  // The 'most recent' year is validYears[0].
  // The 'oldest' year in the block is lastYearVal.
  
  // Re-verify the bounds logic
  const newestRow = validYears[0];
  let newestYear = parseInt(newestRow.period_label);
  if (isNaN(newestYear)) newestYear = new Date(newestRow.period_end_date).getFullYear();

  // 4. Classify
  let maturity: MaturityClassification = 'early';
  if (count < 3) maturity = 'early';
  else if (count >= 3 && count < 5) maturity = 'developing';
  else maturity = 'established';

  return {
    fundamentals_years_count: count,
    fundamentals_first_year: lastYearVal, // The oldest in the block
    fundamentals_last_year: newestYear,   // The newest in the block
    fgos_maturity: maturity
  };
}
