import { rollingFYGrowth } from '@/lib/utils/rollingGrowth';

export interface GrowthContext {
  fgos_maturity: 'early' | 'developing' | 'established' | string | null;
  interpretation_context: {
    industry_cadence: string;
    dominant_horizons_used: string[];
    structural_horizon_min_years: number;
  };
}

export interface FundamentalsGrowthResult {
  revenue_cagr: number | null;
  earnings_cagr: number | null;
  fcf_cagr: number | null;
  status: string;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  coverage: {
    valid_windows: number;
    required_windows: number;
  };
}

/**
 * Calculates CAGR for a specific window (years) from growth rows.
 * Uses geometric mean of (1 + growth_rate).
 */
function calculateWindowCAGR(rows: any[], field: string, years: number): number | null {
  if (!rows || rows.length < years) return null;

  // Sort descending by fiscalYear (newest first)
  const sorted = [...rows]
    .filter(r => Number.isFinite(Number(r[field])))
    .sort((a, b) => Number(b.fiscalYear) - Number(a.fiscalYear));

  if (sorted.length < years) return null;

  // Take the most recent 'years' rows
  const windowRows = sorted.slice(0, years);

  // Calculate compound growth
  // (1+r1)*(1+r2)*... = Total Growth Factor
  let product = 1;
  for (const row of windowRows) {
    product *= (1 + Number(row[field]));
  }

  // CAGR = (Product)^(1/n) - 1
  return Math.pow(product, 1 / years) - 1;
}

export function calculateFundamentalsGrowth(
  incomeGrowthRows: any[],
  cashflowGrowthRows: any[],
  context: GrowthContext
): FundamentalsGrowthResult {
  const { fgos_maturity, interpretation_context } = context;
  const { structural_horizon_min_years, dominant_horizons_used } = interpretation_context;

  // 1. Calculate base CAGRs (Legacy / Display values)
  // Using 3Y or 5Y as standard "CAGR" for display, or falling back to available
  const revenue_cagr = rollingFYGrowth(incomeGrowthRows, 'growthRevenue', 3) ?? rollingFYGrowth(incomeGrowthRows, 'growthRevenue', 2);
  const earnings_cagr = rollingFYGrowth(incomeGrowthRows, 'growthNetIncome', 3) ?? rollingFYGrowth(incomeGrowthRows, 'growthNetIncome', 2);
  const fcf_cagr = rollingFYGrowth(cashflowGrowthRows, 'growthFreeCashFlow', 3) ?? rollingFYGrowth(cashflowGrowthRows, 'growthFreeCashFlow', 2);

  const reasons: string[] = [];
  let status = 'pending';
  let confidence: 'low' | 'medium' | 'high' = 'low';

  // 2. Map dominant horizons to year counts
  // e.g. '1Y' -> 1, '3Y' -> 3
  const horizonToYears = (h: string): number => {
      if (h.endsWith('Y') || h.endsWith('A')) return parseInt(h);
      if (h.endsWith('M')) return 0; // Ignore months for annual growth logic
      return 0;
  };

  const relevantYears = dominant_horizons_used
    .map(horizonToYears)
    .filter(y => y > 0)
    .sort((a, b) => a - b);
  
  // Unique years
  const uniqueYears = Array.from(new Set(relevantYears));

  // 3. Evaluate Windows
  // We primarily focus on Revenue for Growth Status as it's the most stable top-line metric.
  const validWindows: { years: number; cagr: number }[] = [];
  
  // Always calculate standard windows: 1, 3, 5 if possible
  const checkYears = Array.from(new Set([...uniqueYears, 1, 3, 5])).sort((a,b) => a-b);

  for (const y of checkYears) {
      const cagr = calculateWindowCAGR(incomeGrowthRows, 'growthRevenue', y);
      if (cagr !== null) {
          validWindows.push({ years: y, cagr });
      }
  }

  // 4. Maturity Logic
  let valid_windows_count = 0;
  let required_windows_count = 0;

  if (fgos_maturity === 'early') {
      // EARLY: Only consider windows >= structural_horizon_min_years
      const filteredWindows = validWindows.filter(w => w.years >= structural_horizon_min_years);
      
      valid_windows_count = filteredWindows.length;
      required_windows_count = 1;

      if (filteredWindows.length === 0) {
          status = 'pending';
          reasons.push('Insufficient history for structural horizon');
      } else {
          // Analyze filtered windows
          const latest = filteredWindows[0]; // Shortest valid window (sorted asc)
          
          if (latest.cagr > 0.20) status = 'emerging_growth';
          else if (latest.cagr < 0) status = 'inconsistent_growth'; // Or shrinking
          else status = 'emerging_growth'; // Default for early if valid

          // Refine 'inconsistent' check: if we have multiple windows and they vary wildly
          if (filteredWindows.length > 1) {
             const max = Math.max(...filteredWindows.map(w => w.cagr));
             const min = Math.min(...filteredWindows.map(w => w.cagr));
             if (Math.sign(max) !== Math.sign(min)) status = 'inconsistent_growth';
          }
      }
      
      confidence = 'low'; // Early is always low/speculative
      reasons.push('Early maturity constraints applied');

  } else if (fgos_maturity === 'developing') {
      // DEVELOPING: Consider dominant_horizons_used. Require >= 2 aligned valid windows.
      
      // Filter for dominant horizons only
      const domWindows = validWindows.filter(w => uniqueYears.includes(w.years));
      
      valid_windows_count = domWindows.length;
      required_windows_count = 2;

      if (domWindows.length < 2) {
          status = 'pending';
          reasons.push('Fewer than 2 dominant horizons available');
          confidence = 'low';
      } else {
          // Check alignment
          const cagrs = domWindows.map(w => w.cagr);
          const positive = cagrs.every(c => c > 0);
          const negative = cagrs.every(c => c < 0);
          const aligned = positive || negative;
          
          const volatility = Math.max(...cagrs) - Math.min(...cagrs);
          
          if (!aligned) {
              status = 'volatile_growth';
          } else if (volatility < 0.10) { // Arbitrary threshold for stability
              status = 'stable_growth';
          } else {
               // Check trend
               // domWindows is sorted by years ASC (1Y, 3Y...)
               // Improving means 1Y > 3Y
               const short = domWindows[0].cagr;
               const long = domWindows[domWindows.length - 1].cagr;
               
               if (short > long * 1.1) status = 'improving_growth';
               else if (short < long * 0.9) status = 'volatile_growth'; // Decelerating is often seen as volatile or just 'stable' if close? 
               else status = 'stable_growth';
          }
          
          confidence = 'medium';
      }

  } else if (fgos_maturity === 'established') {
      // ESTABLISHED: Require dominant horizons PLUS at least one long horizon (>= 5Y)
      
      const domWindows = validWindows.filter(w => uniqueYears.includes(w.years));
      const longWindows = validWindows.filter(w => w.years >= 5);
      
      // For established, we treat "valid_windows" as the count of conditions met for coverage calculation purposes
      // Condition 1: Has dominant windows
      // Condition 2: Has long windows
      valid_windows_count = (domWindows.length > 0 ? 1 : 0) + (longWindows.length > 0 ? 1 : 0);
      required_windows_count = 2;
      
      if (domWindows.length === 0 || longWindows.length === 0) {
          status = 'pending';
          reasons.push('Missing dominant or long-term (5Y+) horizons');
          confidence = 'medium'; // Established but missing data
      } else {
          const allRelevant = [...domWindows, ...longWindows];
          const avgCagr = allRelevant.reduce((sum, w) => sum + w.cagr, 0) / allRelevant.length;
          
          if (avgCagr > 0.15) status = 'strong_growth';
          else if (avgCagr > 0.05) status = 'moderate_growth';
          else status = 'weak_growth';
          
          confidence = 'high';
      }
  } else {
      // Fallback for unknown maturity (shouldn't happen)
      status = 'pending';
      reasons.push('Unknown maturity status');
  }

  return {
    revenue_cagr,
    earnings_cagr,
    fcf_cagr,
    status,
    confidence,
    reasons,
    coverage: {
        valid_windows: valid_windows_count,
        required_windows: required_windows_count
    }
  };
}
