export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      fintra_snapshots: {
        Row: {
          id: string
          ticker: string
          calculated_at: string
          fgos_score: number
          fgos_breakdown: Json
          valuation_score: number
          valuation_status: string
          verdict_text: string | null
          sector: string | null
          ecosystem_data: Json | null
          ai_report_markdown: string | null
        }
        Insert: {
          id?: string
          ticker: string
          calculated_at: string
          fgos_score: number
          fgos_breakdown: Json
          valuation_score: number
          valuation_status: string
          verdict_text?: string | null
          sector?: string | null
          ecosystem_data?: Json | null
          ai_report_markdown?: string | null
        }
        Update: {
          id?: string
          ticker?: string
          calculated_at?: string
          fgos_score?: number
          fgos_breakdown?: Json
          valuation_score?: number
          valuation_status?: string
          verdict_text?: string | null
          sector?: string | null
          ecosystem_data?: Json | null
          ai_report_markdown?: string | null
        }
      }
      fintra_ecosystem_reports: {
        Row: {
            id: string
            ticker: string
            date: string
            data: Json
            ecosystem_score: number
            report_md: string
            created_at: string
        }
        Insert: {
            id?: string
            ticker: string
            date: string
            data: Json
            ecosystem_score: number
            report_md: string
            created_at?: string
        }
        Update: {
            id?: string
            ticker?: string
            date?: string
            data?: Json
            ecosystem_score?: number
            report_md?: string
            created_at?: string
        }
      }
      fintra_ecosystem_relations: {
        Row: {
            id: string
            symbol: string
            partner_symbol: string
            relation_type: string
            revenue_dependency: number | null
            cost_dependency: number | null
            partner_fgos: number | null
            partner_valuation: number | null
            partner_ehs: number | null
            partner_verdict: string | null
        }
        Insert: {
            id?: string
            symbol: string
            partner_symbol: string
            relation_type: string
            revenue_dependency?: number | null
            cost_dependency?: number | null
            partner_fgos?: number | null
            partner_valuation?: number | null
            partner_ehs?: number | null
            partner_verdict?: string | null
        }
        Update: {
            id?: string
            symbol?: string
            partner_symbol?: string
            relation_type?: string
            revenue_dependency?: number | null
            cost_dependency?: number | null
            partner_fgos?: number | null
            partner_valuation?: number | null
            partner_ehs?: number | null
            partner_verdict?: string | null
        }
      }
      busquedas_acciones: {
        Row: {
            id: number
            symbol: string
            busquedas: number
            ultima_busqueda: string
        }
        Insert: {
            id?: number
            symbol: string
            busquedas?: number
            ultima_busqueda?: string
        }
        Update: {
            id?: number
            symbol?: string
            busquedas?: number
            ultima_busqueda?: string
        }
      }
      periodos_accion: {
        Row: {
            id: number
            symbol: string
            period: string
            updated_at: string
        }
        Insert: {
            id?: number
            symbol: string
            period: string
            updated_at?: string
        }
        Update: {
            id?: number
            symbol?: string
            period?: string
            updated_at?: string
        }
      }
    }
    Views: {
      [_: string]: never
    }
    Functions: {
      [_: string]: never
    }
    Enums: {
      [_: string]: never
    }
    CompositeTypes: {
      [_: string]: never
    }
  }
}
