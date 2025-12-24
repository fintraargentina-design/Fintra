export interface FgosBreakdown {
  growth: number;        // 20%
  profitability: number; // 20%
  efficiency: number;    // 20%
  solvency: number;      // 15%
  moat: number;          // 15%
  sentiment: number;     // 10%
}

export interface FgosResult {
  ticker: string;
  fgos_score: number;
  fgos_breakdown: FgosBreakdown;
  valuation_status: string;
  ecosystem_score?: number;
  calculated_at: string;
  price?: number;
}
