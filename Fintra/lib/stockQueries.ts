import { supabase, registerStockSearch } from "./supabase";
import type { FMPCompanyProfile as FMPStockData } from "./fmp/types";
import { FinancialSnapshot } from "@/lib/engine/types";

export { supabase, registerStockSearch };

// Interfaces para los tipos de datos
export interface StockData extends FMPStockData {
  // Agregar el objeto datos completo
  datos?: any;
  dividendos?: any;
  valoracion?: any;

  // Campos de valoración específicos
  valoracion_pe?: string;
  valoracion_peg?: string;
  valoracion_pbv?: string;
  valoracion_implied_growth?: string;
  dividend_yield?: string;

  // Campos fundamentales existentes
  roe?: number;
  roic?: number;
  net_margin?: number;
  gross_margin?: number;
  debt_equity?: number;
  free_cash_flow?: number;
  current_ratio?: number;
  equity_cagr_5y?: number;
  revenue_cagr_5y?: number;
  interest_coverage?: number;
  net_income_cagr_5y?: number;
  book_value_per_share?: number;
  shares_outstanding?: number;
  quick_ratio?: number;

  // Performance specific fields
  performance_1m?: number;
  performance_3m?: number;
  performance_ytd?: number;
  performance_1y?: number;
  performance_3y?: number;
  performance_5y?: number;

  // Legacy fields
  company_name?: string;
  current_price?: number;
  market_cap?: number;

  // Fintra-specific fields (from snapshots and market_state)
  fgos_score?: number | null;
  fgos_confidence?: number | null;
  fgos_confidence_label?: string | null;
  fgos_category?: string | null;
  valuation_status?: string | null;
  verdict_text?: string | null;
  strategy_state?: any | null;
  ytd_return?: number | null;
  change_percentage?: number | null;
  snapshot_date?: string | null;
  _hasSnapshot?: boolean;

  // Structural Profile & Complex objects
  ifs?: any;
  ifs_fy?: any;
  fgos_components?: any;
  raw_profile_structural?: any;
  sector_rank?: number | null;
  sector_rank_total?: number | null;
  fgos_status?: string | null;

  [key: string]: any;
}

export interface StockAnalysis {
  symbol: string;
  recommendation?: string;
  target_price?: number;
  analyst_rating?: string;
  [key: string]: any;
}

export interface StockPerformance {
  symbol: string;
  day_1?: number;
  week_1?: number;
  month_1?: number;
  month_3?: number;
  month_6?: number;
  year_1?: number;
  ytd?: number;
  [key: string]: any;
}

export async function getValuationHistory(symbol: string) {
  try {
    const { data, error } = await supabase
      .from("datos_valuacion")
      .select("*")
      .eq("ticker", symbol)
      .order("valuation_date", { ascending: false });

    if (error) {
      console.error("Error fetching valuation history:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Exception fetching valuation history:", err);
    return [];
  }
}

// Función principal para buscar todos los datos de una acción
export async function searchStockData(symbol: string) {
  try {
    console.log(`Buscando ${symbol} en APIs internas (DB-First)...`);

    // Registrar búsqueda
    registerStockSearch(symbol);

    // Call unified API
    const response = await fetch(
      `/api/stock-data?symbol=${encodeURIComponent(symbol)}`,
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      basicData: (data.stockBasicData || data.basicData) as StockData | null,
      analysisData: (data.stockAnalysis || data.analysisData) as StockAnalysis | null,
      performanceData: (data.stockPerformance || data.performanceData) as StockPerformance | null,
      ecosystemData: data.stockEcosystem || data.ecosystemData,
      financialSnapshot: data.financialSnapshot as FinancialSnapshot | null,
      stockRatios: data.stockRatios,
      stockMetrics: data.stockMetrics,
      success: !!(data.stockBasicData || data.basicData),
      error: (data.stockBasicData || data.basicData) ? null : "No se encontraron datos básicos",
    };
  } catch (error) {
    console.error("Error general en búsqueda:", error);
    return {
      basicData: null,
      analysisData: null,
      performanceData: null,
      ecosystemData: null,
      financialSnapshot: null,
      stockRatios: null,
      stockMetrics: null,
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

// Función para buscar solo datos básicos
export async function getBasicStockData(
  symbol: string,
): Promise<StockData | null> {
  try {
    const response = await fetch(
      `/api/stock-data?symbol=${encodeURIComponent(symbol)}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.stockBasicData || data.basicData || null;
  } catch (error) {
    console.error("Error en getBasicStockData:", error);
    return null;
  }
}

// Función para buscar solo análisis
export async function getStockAnalysisData(
  symbol: string,
): Promise<StockAnalysis | null> {
  try {
    // We reuse the unified API as it is efficient enough
    const response = await fetch(
      `/api/stock-data?symbol=${encodeURIComponent(symbol)}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.stockAnalysis || data.analysisData || null;
  } catch (error) {
    console.error("Error en getStockAnalysisData:", error);
    return null;
  }
}

// Función para buscar solo rendimiento
export async function getStockPerformanceData(
  symbol: string,
): Promise<StockPerformance | null> {
  try {
    const response = await fetch(
      `/api/stock-data?symbol=${encodeURIComponent(symbol)}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.stockPerformance || data.performanceData || null;
  } catch (error) {
    console.error("Error en getStockPerformanceData:", error);
    return null;
  }
}
