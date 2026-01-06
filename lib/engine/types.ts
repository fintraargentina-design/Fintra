export type FgosCategory =
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Pending';

export interface FgosBreakdown {
  growth: number | null;
  profitability: number | null;
  efficiency: number | null;
  solvency: number | null;
}

export interface FgosResult {
  ticker: string;

  fgos_score: number | null;
  fgos_category: FgosCategory;

  fgos_breakdown: FgosBreakdown;

  confidence: number;

  quality_warnings?: string[];   // ✅ AGREGAR

  calculated_at: string;
}
