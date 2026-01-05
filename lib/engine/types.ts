// lib/engine/types.ts

export interface FgosBreakdown {
  growth: number;
  profitability: number;
  efficiency: number;
  solvency: number;
  moat: number;
  sentiment: number;
}

export interface FgosResult {
  ticker?: string;
  fgos_score?: number;
  fgos_breakdown: FgosBreakdown;
  valuation_score?: number;
  valuation_status?: string;
  ecosystem_score?: number;
  calculated_at?: string;
  price?: number;
  score?: number; // legacy
  valuation_gap?: number; // legacy
  fair_value?: number; // legacy
}

// --- TIPOS PARA LA IA (Input) ---
export interface EcoNodeJSON {
  id: string;
  n: string;
  dep: number;
  ehs: number;
  health_signal: number;   // Antes fgos
  market_sentiment: number; // Antes valuation
  txt: string;
  country?: string; // Opcional, usado en UI
}

// --- TIPOS PARA LA BASE DE DATOS (Output) ---
export interface EcosystemDataJSON {
  suppliers: EcoNodeJSON[];
  clients: EcoNodeJSON[];
}

export interface EcosystemReportDB {
  id?: string;
  ticker: string;
  date: string;
  data: EcosystemDataJSON;
  report_md?: string;
  ecosystem_score: number;
  created_at?: string;
}

export interface FintraSnapshotDB {
  id?: string;
  ticker: string;
  date?: string; // mapped from calculated_at
  
  // Campos Financieros (FGOS)
  fgos_score: number;
  fgos_breakdown: any;
  
  // Campos Ecosistema (Referencia o Score resumen)
  ecosystem_score?: number;
  
  // Legacy / Otros
  valuation_status?: string;
  valuation_score?: number;
  verdict_text?: string;
}

// Interfaz para la relación relacional (Legacy o para compatibilidad si se mantiene)
export interface EcosystemRelationDB {
  id?: string;
  symbol: string;
  partner_symbol: string;
  relation_type: 'SUPPLIER' | 'CLIENT';
  revenue_dependency?: number;
  cost_dependency?: number;
  // Campos enriquecidos
  partner_fgos?: number;
  partner_valuation?: number;
  partner_ehs?: number;
  partner_verdict?: string;
}