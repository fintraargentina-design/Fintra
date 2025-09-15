import { supabase } from './supabase';
import { fmp } from './fmp/client';

export { supabase, registerStockSearch, getStockProyecciones } from './supabase';
export type { StockProyeccionRow } from './supabase';

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
  dividendos?: any;
  valoracion?: any;  // Agregar esta línea
  
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
    // Buscar en Supabase primero
    const { data: datosData, error: datosError } = await supabase
      .from('datos_accion')
      .select(`symbol, fecha_de_creacion, datos`)
      .eq('symbol', symbol.toUpperCase())
      .order('fecha_de_creacion', { ascending: false })
      .limit(1)
      .single();

    // Si no se encuentra en Supabase, buscar en APIs externas
    if (datosError && datosError.code === 'PGRST116') {
      console.log(`Ticker ${symbol} no encontrado en Supabase, buscando en APIs externas...`);
      
      try {
        // Usar SOLO el cliente FMP que llama a /api/fmp/*
        const profileData = await fmp.profile(symbol);
        
        if (profileData && profileData.length > 0) {
          const profile = profileData[0];
          // Formatear datos para que coincidan con la estructura esperada
          const processedData = {
            symbol: symbol.toUpperCase(),
            company_name: profile.companyName,
            current_price: profile.price,
            market_cap: profile.mktCap,
            pe_ratio: undefined, // profile.pe no existe en FMPCompanyProfile
            volume: undefined, // profile.volume tampoco existe en FMPCompanyProfile
            industry: profile.industry,
            country: undefined, // profile.country tampoco existe en FMPCompanyProfile
            sector: profile.sector,
            exchange: profile.exchange,
            website: undefined, // profile.website tampoco existe en FMPCompanyProfile
            description: undefined, // profile.description tampoco existe en FMPCompanyProfile
            // ... más campos según necesites
          };
          
          return {
            basicData: processedData,
            analysisData: null, // No disponible desde API externa
            performanceData: null, // No disponible desde API externa
            reportData: null, // No disponible desde API externa
            success: true,
            fromExternalAPI: true // Flag para indicar origen
          };
        }
      } catch (apiError) {
        console.error('Error en APIs externas:', apiError);
        throw new Error(`No se pudieron obtener datos para ${symbol}`);
      }
    }
    
    // Si llegamos aquí, usar los datos de Supabase (datosData ya está declarado arriba)
    if (datosError) {
      console.error('Error buscando datos en Supabase:', datosError);
      return { 
        success: false, 
        error: datosError.message || 'Error al buscar datos en la base de datos'
      };
    }

    // Remove the duplicate declaration - datosData is already available from line 89
    // const { data: datosData, error: datosError } = await supabase... <- REMOVE THIS

    // Buscar análisis
    const { data: analysisData, error: analysisError } = await supabase
      .from('stock_analysis')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    // Only log if there's actually an error and it's not the "no rows" error
    if (analysisError && analysisError.code && analysisError.code !== 'PGRST116') {
      console.error('Error en análisis:', {
        message: analysisError.message || 'Sin mensaje',
        details: analysisError.details || 'Sin detalles',
        hint: analysisError.hint || 'Sin hint',
        code: analysisError.code || 'Sin código',
        fullError: analysisError
      });
    }
    
    // Remove or modify this section that's causing the empty object log
    if (analysisError && !analysisError.code) {
      // Only log if the error object actually has meaningful content
      if (Object.keys(analysisError).length > 0) {
        console.warn('analysisError sin código:', {
          error: analysisError,
          type: typeof analysisError,
          keys: Object.keys(analysisError || {}),
          stringified: JSON.stringify(analysisError)
        });
      }
    }

    // Si no hay datos de análisis, crear un objeto por defecto
    if (!analysisData && analysisError?.code === 'PGRST116') {
      console.info(`No se encontraron datos de análisis para ${symbol}`);
    }
    
    // Buscar rendimiento
    const { data: performanceData, error: performanceError } = await supabase
      .from('stock_performance')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    // Mejorar el manejo de errores de performance
    if (performanceError) {
      // Solo hacer log si hay un error real (no "no rows found")
      if (performanceError.code && performanceError.code !== 'PGRST116') {
        console.error('Error en rendimiento:', {
          message: performanceError.message || 'Sin mensaje',
          details: performanceError.details || 'Sin detalles',
          hint: performanceError.hint || 'Sin sugerencia',
          code: performanceError.code || 'Sin código',
          fullError: performanceError
        });
      }
      // Si es PGRST116 (no rows found), es normal y no es un error
      else if (performanceError.code === 'PGRST116') {
        console.info(`No se encontraron datos de rendimiento para ${symbol}`);
      }
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
          analisisFundamental: {
            // Preservar propiedades del nivel superior
            ...parsedReport.analisisFundamental,
            // Sobrescribir con el contenido anidado si existe
            ...(parsedReport.analisisFundamental?.analisisFundamental || {})
          },
          analisisCualitativo: {
            ...parsedReport.analisisCualitativo,
          },
          analisisValoracion: {
            // Preservar propiedades del nivel superior
            ...parsedReport.analisisValoracion,
            // Sobrescribir con el contenido anidado si existe
            ...(parsedReport.analisisValoracion?.analisisValoracion || {})
          },
          analisisDividendos: {
            // Preservar propiedades del nivel superior
            ...parsedReport.analisisDividendos,
            // Sobrescribir con el contenido anidado si existe
            ...(parsedReport.analisisDividendos?.analisisDividendos || {})
          },
          analisisDesempeno: {
            // Preservar propiedades del nivel superior
            ...parsedReport.analisisDesempeno,
            // Sobrescribir con el contenido anidado si existe
            ...(parsedReport.analisisDesempeno?.analisisDesempeno || {})
          }
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
      success: true,
      error: null
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

export async function getBasicStockData(symbol: string): Promise<StockData | null> {
  try {
    const { data, error } = await supabase
      .from('datos_accion')
      .select('*, datos')
      .eq('symbol', symbol.toUpperCase())
      .order('fecha_de_creacion', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error al obtener datos básicos:', error);
      return null;
    }

    // Verificar que data existe y no es un error
    if (!data) {
      console.warn('No se encontraron datos para el símbolo:', symbol);
      return null;
    }

    // Extraer dividendos y valoracion del JSON de forma segura
    const parsedData = data.datos || {};
    return {
      ...data,
      dividendos: parsedData?.dividendos || null,
      valoracion: parsedData?.valoracion || null
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

    // Después de la consulta de análisis, agregar:
    console.log('Resultado de análisis:', {
      symbol: symbol.toUpperCase(),
      hasData: !!data,
      hasError: !!error,
      errorType: typeof error,
      errorCode: error?.code,
      dataKeys: data ? Object.keys(data) : 'No data'
    });
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

// Agregar nueva interface después de las existentes
export interface StockConclusion {
  symbol: string;
  conclusion?: any;
  [key: string]: any;
}

// Agregar nueva función al final del archivo
export async function getStockConclusionData(symbol: string): Promise<StockConclusion | null> {
  try {
    const { data, error } = await supabase
      .from('conclusion_rapida')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .order('fecha_de_creacion', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Error al obtener conclusión rápida:', error);
      }
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error en getStockConclusionData:', error);
    return null;
  }
}