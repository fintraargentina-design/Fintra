export interface FintraScoreBreakdown {
  growth: {
    score: number;
    metrics: {
      revenueGrowth: number | null;
      epsGrowth: number | null;
    };
  };
  profitability: {
    score: number;
    metrics: {
      grossMargin: number | null;
      netMargin: number | null;
    };
  };
  efficiency: {
    score: number;
    metrics: {
      roic: number | null;
      assetTurnover: number | null;
    };
  };
  solvency: {
    score: number;
    metrics: {
      currentRatio: number | null;
      debtToEquity: number | null;
    };
  };
  moat: {
    score: number;
    metrics: {
      grossMarginStability: number | null; // Placeholder for moat metric
      roicStability: number | null; // Placeholder
    };
  };
  sentiment: {
    score: number;
    metrics: {
      analystRatings: number | null; // Placeholder
      newsSentiment: number | null; // Placeholder
    };
  };
}

export interface FintraVerdict {
  action: 'BUY' | 'HOLD' | 'SELL' | 'WATCH';
  summary: string;
}

export interface FintraSnapshot {
  symbol: string;
  date: string;
  fgos_score: number;
  fgos_breakdown: FintraScoreBreakdown;
  valuation_status: 'Undervalued' | 'Fair' | 'Overvalued';
  ecosystem_score: number;
  verdict?: FintraVerdict;
}
