export interface FintraScoreBreakdown {
  growth: {
    score: number;
    details: {
      revenue_growth: number;
      net_income_growth: number;
      fcf_growth: number;
    };
  };
  profitability: {
    score: number;
    details: {
      roe: number;
      roic: number;
      net_margin: number;
      fcf_margin: number;
    };
  };
  financial_health: {
    score: number;
    details: {
      current_ratio: number;
      debt_to_equity: number;
      interest_coverage: number;
      altman_z: number;
    };
  };
  valuation: {
    score: number;
    details: {
      pe_ratio: number;
      pfcf_ratio: number;
      ev_ebitda: number;
      peg_ratio: number;
    };
  };
  momentum: {
    score: number;
    details: {
      price_vs_50sma: number;
      price_vs_200sma: number;
      rsi: number;
      relative_strength: number;
    };
  };
}

export interface FintraSnapshot {
  id?: string;
  ticker: string;
  calculated_at: string; // ISO date
  overall_score: number;
  valuation_status: 'Undervalued' | 'Fair' | 'Overvalued' | 'N/A';
  score_breakdown: FintraScoreBreakdown;
  price_at_calculation: number;
  fair_value_estimate?: number;
}
