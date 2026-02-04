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
      ecosystem_reports: {
        Row: {
          id: string
          ticker: string
          date: string
          data: Json
          ecosystem_score: number | null
          report_md: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ticker: string
          date?: string
          data: Json
          ecosystem_score?: number | null
          report_md?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ticker?: string
          date?: string
          data?: Json
          ecosystem_score?: number | null
          report_md?: string | null
          created_at?: string
        }
      }
      fintra_snapshots: {
        Row: {
          id: number
          symbol: string
          snapshot_date: string
          price: number | null
          market_cap: number | null
          pe_ratio: number | null
          fintrascore: number | null
          valuation_gap: number | null
          created_at: string
        }
        Insert: {
          id?: number
          symbol: string
          snapshot_date?: string
          price?: number | null
          market_cap?: number | null
          pe_ratio?: number | null
          fintrascore?: number | null
          valuation_gap?: number | null
          created_at?: string
        }
        Update: {
          id?: number
          symbol?: string
          snapshot_date?: string
          price?: number | null
          market_cap?: number | null
          pe_ratio?: number | null
          fintrascore?: number | null
          valuation_gap?: number | null
          created_at?: string
        }
      }
      prices_daily: {
        Row: {
          ticker: string
          price_date: string
          open: number | null
          high: number | null
          low: number | null
          close: number
          adj_close: number | null
          volume: number | null
          source: string | null
          created_at: string
        }
        Insert: {
          ticker: string
          price_date: string
          open?: number | null
          high?: number | null
          low?: number | null
          close: number
          adj_close?: number | null
          volume?: number | null
          source?: string | null
          created_at?: string
        }
        Update: {
          ticker?: string
          price_date?: string
          open?: number | null
          high?: number | null
          low?: number | null
          close?: number
          adj_close?: number | null
          volume?: number | null
          source?: string | null
          created_at?: string
        }
      }
      // ... Agrega aquí otras tablas si es necesario
    }
  }
}
