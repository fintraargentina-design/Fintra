import { supabase } from './supabase';
import { fmp } from './fmp/client';
import type { FMPCompanyProfile as FMPStockData } from './fmp/types';

export { supabase, registerStockSearch } from './supabase';

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

// Función principal para buscar todos los datos de una acción
export async function searchStockData(symbol: string) {
  try {
    console.log(`Buscando ${symbol} en APIs externas...`);
    
    // Inicializar variables
    let processedData: StockData | null = null;
    let analysisData = null;
    let performanceData = null;
    let ecosystemData = null;

    // 1. Fetch Basic Data from FMP
    try {
      const profileData = await fmp.profile(symbol);
      
      if (profileData && profileData.length > 0) {
        const profile = profileData[0];
        // Formatear datos para que coincidan con la estructura esperada
        processedData = {
          ...profile,
          symbol: symbol.toUpperCase(),
          companyName: profile.companyName,
          price: profile.price,
          mktCap: profile.mktCap,
          // Mapping fields that might differ or be required by interface
          changes: profile.changes,
          currency: profile.currency,
          exchange: profile.exchange,
          industry: profile.industry,
          sector: profile.sector,
          description: profile.description,
          ceo: profile.ceo,
          website: profile.website,
          image: profile.image,
          
          // Legacy/Extra fields compatibility
          company_name: profile.companyName,
          current_price: profile.price,
          market_cap: profile.mktCap,
          
          // Initialize optional fields
          dividendos: null,
          valoracion: null
        };
      }
    } catch (apiError) {
      console.error('Error en APIs externas (FMP):', apiError);
    }

    // 2. Buscar análisis (Supabase)
    const { data: analysisResult, error: analysisError } = await supabase
      .from('stock_analysis')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (analysisError && analysisError.code && analysisError.code !== 'PGRST116' && analysisError.code !== '42P01') {
      console.error('Error en análisis:', {
        message: analysisError.message || 'Sin mensaje',
        code: analysisError.code || 'Sin código'
      });
    }
    analysisData = analysisResult;

    // 3. Buscar rendimiento (Supabase)
    const { data: performanceResult, error: performanceError } = await supabase
      .from('stock_performance')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (performanceError) {
      if (performanceError.code && performanceError.code !== 'PGRST116' && performanceError.code !== '42P01') {
        console.error('Error en rendimiento:', performanceError);
      }
    }
    performanceData = performanceResult;

    // 5. Buscar datos del ecosistema (holders e insiders) desde FMP
    try {
      const [holders, insiders] = await Promise.all([
        fmp.institutionalHolders(symbol.toUpperCase()),
        fmp.insiderTrading(symbol.toUpperCase(), { limit: 20 })
      ]);
      ecosystemData = { holders, insiders };
    } catch (e) {
      console.warn('Error fetching ecosystem data:', e);
    }

    return {
      basicData: processedData,
      analysisData: analysisData as StockAnalysis,
      performanceData: performanceData as StockPerformance,
      ecosystemData,
      success: !!processedData,
      error: processedData ? null : 'No se encontraron datos básicos'
    };

  } catch (error) {
    console.error('Error general en búsqueda:', error);
    return {
      basicData: null,
      analysisData: null,
      performanceData: null,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para buscar solo datos básicos
export async function getBasicStockData(symbol: string): Promise<StockData | null> {
  try {
    const profileData = await fmp.profile(symbol);

    if (!profileData || profileData.length === 0) {
      console.warn('No se encontraron datos para el símbolo:', symbol);
      return null;
    }

    const profile = profileData[0];
    return {
      ...profile,
      symbol: symbol.toUpperCase(),
      companyName: profile.companyName,
      price: profile.price,
      mktCap: profile.mktCap,
      changes: profile.changes,
      currency: profile.currency,
      exchange: profile.exchange,
      industry: profile.industry,
      sector: profile.sector,
      description: profile.description,
      ceo: profile.ceo,
      website: profile.website,
      image: profile.image,
      
      // Legacy compatibility
      company_name: profile.companyName,
      current_price: profile.price,
      market_cap: profile.mktCap,
      
      dividendos: null,
      valoracion: null
    } as StockData;
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


