
// Helper for safe division
const div = (n: number | undefined | null, d: number | undefined | null) => {
  if (!n || !d || d === 0) return null;
  return n / d;
};

// Helper for CAGR
function calculateCAGR(values: { date: string; value: number }[], targetDate: string): number | null {
  // 1. Sort by date ascending
  const sorted = values
    .filter(v => v.value && v.value !== 0) // Filter invalid values
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (sorted.length < 3) return null; // Requirement: at least 3 points

  // 2. Find ending point (closest to targetDate but <= targetDate)
  // Actually, targetDate is the end date of the period we are computing for.
  // So we should use that as the "ending" point.
  // But wait, the input `values` are historical FYs.
  
  // Filter to only include points <= targetDate
  const validHistory = sorted.filter(v => v.date <= targetDate);
  
  if (validHistory.length < 3) return null;

  const end = validHistory[validHistory.length - 1];
  const start = validHistory[0];

  // Calculate years difference
  const years = (new Date(end.date).getTime() - new Date(start.date).getTime()) / (1000 * 60 * 60 * 24 * 365);
  
  if (years < 2) return null; // Need at least 2 years span for 3 points (e.g. 2022, 2023, 2024)

  const cagr = Math.pow(end.value / start.value, 1 / years) - 1;
  return isFinite(cagr) ? cagr : null;
}

export function deriveFinancialMetrics(params: {
  income: any;
  balance: any;
  cashflow: any;
  metricsTTM?: any; // Only provided if periodType === 'TTM' and it matches the period
  ratiosTTM?: any;  // Only provided if periodType === 'TTM'
  historicalIncome?: any[]; // Array of FY income statements
  historicalCashflow?: any[]; // Array of FY cashflow statements
  historicalBalance?: any[]; // Array of FY balance sheets
  periodType: 'FY' | 'TTM';
  periodEndDate: string;
}) {
  const { 
    income, balance, cashflow, 
    metricsTTM, ratiosTTM, 
    historicalIncome, historicalCashflow, historicalBalance,
    periodType, periodEndDate 
  } = params;

  // Extract raw values
  const revenue = income.revenue;
  const netIncome = income.netIncome;
  const opIncome = income.operatingIncome;
  const costOfRev = income.costOfRevenue;
  const interestExpense = income.interestExpense;
  const grossProfit = income.grossProfit;
  const ebitda = income.ebitda;
  
  const totalEquity = balance.totalStockholdersEquity;
  const totalDebt = balance.totalDebt;
  const totalCurrentAssets = balance.totalCurrentAssets;
  const totalCurrentLiabilities = balance.totalCurrentLiabilities;
  // Use weightedAverageShsOut (Diluted usually preferred for valuation, but Basic common for BVPS)
  // FMP often has weightedAverageShsOut or weightedAverageShsOutDil
  const sharesOutstanding = income.weightedAverageShsOutDil || income.weightedAverageShsOut;
  
  const opCashFlow = cashflow.operatingCashFlow;
  const capex = cashflow.capitalExpenditure;

  // --- DERIVATION RULES ---

  // 1. Operating Margin
  // Rule: operatingIncome / revenue
  const operatingMargin = div(opIncome, revenue);

  // 2. Net Margin
  // Rule: netIncome / revenue
  const netMargin = div(netIncome, revenue);

  // 3. FCF Margin
  // Rule: freeCashFlow / revenue
  // FCF = OCF - Abs(Capex)
  const fcfVal = (opCashFlow || 0) - Math.abs(capex || 0);
  const fcfMargin = div(fcfVal, revenue);

  // 4. ROIC
  // Rule: Prefer ROIC from key-metrics-ttm-bulk if available (and TTM)
  // Otherwise: NOPAT / Invested Capital (Net Income / (Equity + Debt))
  let roic = null;
  if (periodType === 'TTM' && metricsTTM?.roicTTM != null) {
    roic = metricsTTM.roicTTM; 
  } else {
    // Fallback or FY
    const investedCapital = (totalEquity || 0) + (totalDebt || 0);
    roic = div(netIncome, investedCapital);
  }

  // 5. Debt to Equity
  // Rule: totalDebt / totalEquity
  const debtToEquity = div(totalDebt, totalEquity);

  // 6. Interest Coverage
  // Rule: EBIT / interestExpense
  // opIncome is EBIT equivalent for most purposes
  const interestCoverage = div(opIncome, interestExpense);
  
  // 7. Gross Margin
  const grossMargin = div(grossProfit, revenue);

  // 8. ROE
  // Rule: Net Income / Total Equity
  const roe = div(netIncome, totalEquity);

  // 9. Current Ratio
  // Rule: Current Assets / Current Liabilities
  const currentRatio = div(totalCurrentAssets, totalCurrentLiabilities);

  // 10. Book Value Per Share
  // Rule: Total Equity / Shares Outstanding
  const bookValuePerShare = div(totalEquity, sharesOutstanding);

  // 11. EBITDA Margin
  const ebitdaMargin = div(ebitda, revenue);
  
  // 12. WACC (Pass through if available)
  // Typically only available in TTM metrics
  // Note: FMP might not provide WACC in standard bulk endpoints, but we check if it exists
  const wacc = periodType === 'TTM' && metricsTTM?.wacc ? metricsTTM.wacc : null;

  // 13. Data Completeness (Simple heuristic)
  // Score 0-100 based on presence of key fields
  let completenessScore = 0;
  if (revenue) completenessScore += 20;
  if (netIncome) completenessScore += 20;
  if (totalEquity) completenessScore += 20;
  if (opCashFlow) completenessScore += 20;
  if (totalDebt !== undefined) completenessScore += 20;
  const dataCompleteness = completenessScore;

  // 14. Data Freshness (Days since period end)
  // Used to filter stale data
  const daysSinceEnd = (Date.now() - new Date(periodEndDate).getTime()) / (1000 * 60 * 60 * 24);
  const dataFreshness = Math.max(0, Math.floor(daysSinceEnd));

  // 15. CAGR (Growth)
  // Rule: Use at least 3 historical points.
  let revenue_cagr = null;
  let earnings_cagr = null;
  let fcf_cagr = null;
  let equity_cagr = null;

  if (historicalIncome && historicalIncome.length >= 3) {
    // Build value arrays
    const revs = historicalIncome.map(r => ({ date: r.date, value: r.revenue }));
    const earns = historicalIncome.map(r => ({ date: r.date, value: r.netIncome }));
    
    revenue_cagr = calculateCAGR(revs, periodEndDate);
    earnings_cagr = calculateCAGR(earns, periodEndDate);
  }
  
  if (historicalCashflow && historicalCashflow.length >= 3) {
    const fcfs = historicalCashflow.map(r => {
      const ocf = r.operatingCashFlow || 0;
      const cap = Math.abs(r.capitalExpenditure || 0);
      return { date: r.date, value: ocf - cap };
    });
    fcf_cagr = calculateCAGR(fcfs, periodEndDate);
  }

  if (historicalBalance && historicalBalance.length >= 3) {
    const eqs = historicalBalance.map(r => ({ date: r.date, value: r.totalStockholdersEquity }));
    equity_cagr = calculateCAGR(eqs, periodEndDate);
  }

  return {
    // Persisted inputs
    revenue,
    net_income: netIncome,
    total_equity: totalEquity,
    total_debt: totalDebt,
    free_cash_flow: fcfVal,
    
    // Derived Metrics
    operating_margin: operatingMargin,
    net_margin: netMargin,
    fcf_margin: fcfMargin,
    roic: roic,
    debt_to_equity: debtToEquity,
    interest_coverage: interestCoverage,
    
    // Newly Added Fields
    gross_margin: grossMargin,
    roe: roe,
    current_ratio: currentRatio,
    book_value_per_share: bookValuePerShare,
    ebitda: ebitda,
    ebitda_margin: ebitdaMargin,
    wacc: wacc,
    data_completeness: dataCompleteness,
    data_freshness: dataFreshness,
    
    // Growth
    revenue_cagr,
    earnings_cagr,
    fcf_cagr,
    equity_cagr
    
    /* derived_from: 'fmp_bulk' */
  };
}
