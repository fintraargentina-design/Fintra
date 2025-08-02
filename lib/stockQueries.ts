import { supabase } from './supabase';

// Interfaces para los tipos de datos
export interface StockData {
  symbol: string;
  company_name?: string;
  current_price?: number;
  market_cap?: number;
  pe_ratio?: number;
  volume?: number;
  industry?: string;
  country?: string;
  sector?: string;
  exchange?: string;
  website?: string;
  description?: string;
  competitive_advantage?: string;
  business_complexity?: string;
  
  // Agregar el objeto datos completo
  datos?: any;
  dividendos?: any;  // Agregar esta línea
  
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

// Nueva interfaz para los datos del informe
export interface StockReport {
  symbol: string;
  analisisFundamental?: any;
  analisisCualitativo?: any;
  analisisValoracion?: any;
  analisisDividendos?: any;
  analisisDesempeno?: any;
  [key: string]: any;
}

// Función principal para buscar todos los datos de una acción
export async function searchStockData(symbol: string) {
  try {
    // Buscar en la tabla datos_accion (datos básicos)
    const { data: datosData, error: datosError } = await supabase
      .from('datos_accion')
      .select(`
        symbol,
        fecha_de_creacion,
        datos
      `)
      .eq('symbol', symbol.toUpperCase())
      .order('fecha_de_creacion', { ascending: false })
      .limit(1)
      .single();

    if (datosError && datosError.code !== 'PGRST116') {
      console.error('Error en datos básicos:', datosError);
    }

    // Buscar análisis
    const { data: analysisData, error: analysisError } = await supabase
      .from('stock_analysis')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();
    
    if (analysisError?.code && analysisError.code !== 'PGRST116') {
    console.error('Error en análisis:', analysisError);
    }
    
    if (analysisError && !analysisError.code) {
    console.warn('analysisError presente pero sin código de error:', analysisError);
    }

    // Buscar rendimiento
    const { data: performanceData, error: performanceError } = await supabase
      .from('stock_performance')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (
    performanceError &&
    typeof performanceError === 'object' &&
    'code' in performanceError &&
    performanceError.code !== 'PGRST116'
    ) {
    console.error('Error en rendimiento:', performanceError);
    }

    if (
    performanceError &&
    typeof performanceError === 'object' &&
    'message' in performanceError
    ) {
    console.warn('performanceError con mensaje:', performanceError.message);
    }

    // Buscar informe de analisis_accion
    const { data: reportData, error: reportError } = await supabase
      .from('analisis_accion')
      .select(`
        symbol,
        fecha_de_creacion,
        informe
      `)
      .eq('symbol', symbol.toUpperCase())
      .order('fecha_de_creacion', { ascending: false })
      .limit(1)
      .single();

    if (reportError && reportError.code !== 'PGRST116') {
      console.error('Error en informe:', reportError);
    }

    // Procesar datos básicos si existen
    let processedData: StockData | null = null;
    if (datosData && datosData.datos) {
      try {
        const parsedData = typeof datosData.datos === 'string' 
          ? JSON.parse(datosData.datos) 
          : datosData.datos;
        
        processedData = {
          symbol: datosData.symbol,
          company_name: parsedData.name,
          current_price: parsedData.currentPrice || parsedData.current_price,
          market_cap: parsedData.valoracion?.marketCap || parsedData.marketCap || parsedData.market_cap,
          pe_ratio: parsedData.valoracion?.pe || parsedData.peRatio || parsedData.pe_ratio,
          volume: parsedData.desempeno?.averageVolume || parsedData.volume,
          high: parsedData.high,
          low: parsedData.low,
          open: parsedData.open,
          close: parsedData.close,
          change: parsedData.change,
          changePercent: parsedData.changePercent || parsedData.change_percent,
          industry: parsedData.industry,
          country: parsedData.country,
          sector: parsedData.sector,
          exchange: parsedData.exchange,
          website: parsedData.website,
          description: parsedData.description,
          competitive_advantage: parsedData.moat,
          business_complexity: parsedData.isEasy,
          
          // Agregar datos de valoración específicos
          datos: parsedData, // Mantener el objeto completo para acceso directo
          
          // Agregar datos de performance específicos desde desempeno.performance
          performance_1m: parsedData.desempeno?.performance?.['1M'] ? parseFloat(parsedData.desempeno.performance['1M']) : null,
          performance_3m: parsedData.desempeno?.performance?.['3M'] ? parseFloat(parsedData.desempeno.performance['3M']) : null,
          performance_ytd: parsedData.desempeno?.performance?.['YTD'] ? parseFloat(parsedData.desempeno.performance['YTD']) : null,
          performance_1y: parsedData.desempeno?.performance?.['1Y'] ? parseFloat(parsedData.desempeno.performance['1Y']) : null,
          performance_3y: parsedData.desempeno?.performance?.['3Y'] ? parseFloat(parsedData.desempeno.performance['3Y']) : null,
          performance_5y: parsedData.desempeno?.performance?.['5Y'] ? parseFloat(parsedData.desempeno.performance['5Y']) : null,
          
          // Datos fundamentales existentes
          roe: parsedData.fundamentales?.roe,
          roic: parsedData.fundamentales?.roic,
          net_margin: parsedData.fundamentales?.netMargin,
          gross_margin: parsedData.fundamentales?.grossMargin,
          debt_equity: parsedData.fundamentales?.debtToEquity,
          free_cash_flow: parsedData.fundamentales?.freeCashFlow,
          current_ratio: parsedData.fundamentales?.currentRatio,
          equity_cagr_5y: parsedData.fundamentales?.equityCAGR_5Y,
          revenue_cagr_5y: parsedData.fundamentales?.revenueCAGR_5Y,
          interest_coverage: parsedData.fundamentales?.interestCoverage,
          net_income_cagr_5y: parsedData.fundamentales?.netIncomeCAGR_5Y,
          book_value_per_share: parsedData.fundamentales?.bookValuePerShare,
          shares_outstanding: parsedData.fundamentales?.sharesOutstanding,
          quick_ratio: parsedData.fundamentales?.quick_ratio,
          
          // Datos de valoración específicos para fácil acceso
          valoracion_pe: parsedData.valoracion?.pe,
          valoracion_peg: parsedData.valoracion?.peg,
          valoracion_pbv: parsedData.valoracion?.pbv,
          valoracion_implied_growth: parsedData.valoracion?.impliedGrowth,
          dividend_yield: parsedData.dividendos?.dividendYield
        };
      } catch (parseError) {
        console.error('Error al parsear datos:', parseError);
      }
    }

    // Procesar datos del informe si existen
    let processedReport: StockReport | null = null;
    if (reportData && reportData.informe) {
      try {
        const parsedReport = typeof reportData.informe === 'string' 
          ? JSON.parse(reportData.informe) 
          : reportData.informe;
        
        processedReport = {
          symbol: reportData.symbol,
          analisisFundamental: parsedReport.analisisFundamental,
          analisisCualitativo: parsedReport.analisisCualitativo,
          analisisValoracion: parsedReport.analisisValoracion,
          analisisDividendos: parsedReport.analisisDividendos,
          analisisDesempeno: parsedReport.analisisDesempeno
        };
      } catch (parseError) {
        console.error('Error al parsear informe:', parseError);
      }
    }

    return {
      basicData: processedData,
      analysisData: analysisData as StockAnalysis,
      performanceData: performanceData as StockPerformance,
      reportData: processedReport,
      success: true
    };

  } catch (error) {
    console.error('Error general en búsqueda:', error);
    return {
      basicData: null,
      analysisData: null,
      performanceData: null,
      reportData: null,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para buscar solo datos básicos
// Actualizar getBasicStockData para incluir dividendos
export async function getBasicStockData(symbol: string): Promise<StockData | null> {
  try {
    const { data, error } = await supabase
      .from('datos_accion')
      .select('*, datos->\'dividendos\' as dividendos_extracted')
      .eq('symbol', symbol.toUpperCase())
      .order('fecha_de_creacion', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error al obtener datos básicos:', error);
      return null;
    }

    // Extraer dividendos del JSON
    const parsedData = data.datos;
    return {
      ...data,
      dividendos: parsedData?.dividendos || null
    };
  } catch (error) {
    console.error('Error en getBasicStockData:', error);
    return null;
  }
}

// Función para buscar solo análisis
export async function getStockAnalysisData(symbol: string): Promise<StockAnalysis | null> {
  try {
    const { data, error } = await supabase
      .from('stock_analysis')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (error) {
      console.error('Error al obtener análisis:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error en getStockAnalysisData:', error);
    return null;
  }
}

// Función para buscar solo rendimiento
export async function getStockPerformanceData(symbol: string): Promise<StockPerformance | null> {
  try {
    const { data, error } = await supabase
      .from('stock_performance')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (error) {
      console.error('Error al obtener rendimiento:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error en getStockPerformanceData:', error);
    return null;
  }
}