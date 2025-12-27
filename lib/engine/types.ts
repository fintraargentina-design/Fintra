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
  ecosystem_details?: {
    score: number;
    summary: string;
    suppliers: Array<{ name: string; risk: string }>;
    clients: Array<{ name: string; risk: string }>;
  };
  calculated_at: string;
  price?: number;
}

export interface FintraSnapshotDB {
  symbol: string;
  date: string;
  fgos_score: number;
  valuation_score: number; // 0-100 para el termómetro
  ecosystem_health_score: number; // EHS
  verdict_text: string; // "Alta Oportunidad", "Riesgo", etc.
  valuation_status: string; // "Undervalued", "Fair", "Overvalued"
  sector?: string; // Add optional sector based on instructions
}

export interface EcosystemRelationDB {
  partner_symbol: string;
  partner_name: string;
  relation_type: 'SUPPLIER' | 'CLIENT';
  dependency_score: number;
  risk_level: string;
  // Estos campos vendrían de un JOIN con la snapshot del partner
  partner_fgos?: number;
  partner_valuation?: number;
  partner_ehs?: number;
  partner_verdict?: string;
}
