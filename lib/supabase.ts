import { createClient } from '@supabase/supabase-js'

// Configuración del cliente Supabase
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Interfaces para los datos estructurados
// Agregar interface para dividendos
export interface DividendData {
  dividendYield?: number;
  dividendPerShare?: number;
  frequency?: string;
  payoutRatio?: number;
  fcfPayoutRatio?: number;
  growth5Y?: number;
  ultimoPago?: {
    date?: string;
    amount?: number;
  };
}

// Actualizar StockBasicData interface
export interface StockBasicData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  close: number
  marketCap?: number
  industry?: string
  country?: string
  sector?: string
  exchange?: string
  peRatio?: number
  website?: string
  description?: string
  competitive_advantage?: string
  business_complexity?: string
  dividendos?: DividendData
  valoracion?: any
}

// Actualizar la consulta en getCompleteStockData
export interface StockAnalysisData {
  peRatio?: number;
  eps?: number;
  dividendYield?: number;
  week52High?: number;
  week52Low?: number;
  recommendation?: string;
  targetPrice?: number;
  analystRating?: string;
  performance?: {
    day1?: number;
    week1?: number;
    month1?: number;
    month3?: number;
    month6?: number;
    year1?: number;
    ytd?: number;
  };
}

export interface StockPerformanceData {
  day1?: number;
  week1?: number;
  month1?: number;
  month3?: number;
  month6?: number;
  year1?: number;
  ytd?: number;
}
export async function getCompleteStockData(symbol: string) {
  try {
    const [datosResult, analisisResult] = await Promise.all([
      // Obtener datos básicos con claves específicas
      supabase
        .from('datos_accion')
        .select(`
          symbol,
          fecha_de_creacion,
          datos
        `)
        .eq('symbol', symbol.toUpperCase())
        .order('fecha_de_creacion', { ascending: false })
        .limit(1)
        .single(),
      
      // Obtener análisis con claves específicas
      supabase
        .from('analisis_accion')
        .select(`
          symbol,
          fecha_de_creacion,
          informe
        `)
        .eq('symbol', symbol.toUpperCase())
        .order('fecha_de_creacion', { ascending: false })
        .limit(1)
        .single()
    ])

    // Procesar y estructurar los datos
    const basicData: StockBasicData | null = datosResult.data ? {
      symbol: datosResult.data.symbol,
      name: datosResult.data.datos?.name || symbol,
      price: parseFloat(datosResult.data.datos?.price) || 0,
      change: parseFloat(datosResult.data.datos?.change) || 0,
      changePercent: parseFloat(datosResult.data.datos?.changePercent) || 0,
      volume: parseInt(datosResult.data.datos?.desempeno?.averageVolume) || 0,
      high: parseFloat(datosResult.data.datos?.high) || 0,
      low: parseFloat(datosResult.data.datos?.low) || 0,
      open: parseFloat(datosResult.data.datos?.open) || 0,
      close: parseFloat(datosResult.data.datos?.close) || 0,
      marketCap: parseInt(datosResult.data.datos?.valoracion?.marketCap) || undefined,
      industry: datosResult.data.datos?.industry || undefined,
      country: datosResult.data.datos?.country || undefined,
      sector: datosResult.data.datos?.sector || undefined,
      exchange: datosResult.data.datos?.exchange || undefined,
      peRatio: parseFloat(datosResult.data.datos?.valoracion?.pe) || undefined,
      website: datosResult.data.datos?.website || undefined,
      description: datosResult.data.datos?.description || undefined,
      competitive_advantage: datosResult.data.datos?.moat || undefined,
      business_complexity: datosResult.data.datos?.isEasy || undefined,
      dividendos: datosResult.data.datos?.dividendos || undefined,
      valoracion: datosResult.data.datos?.valoracion || undefined
    } : null

    const analysisData: StockAnalysisData | null = analisisResult.data ? {
      peRatio: parseFloat(analisisResult.data.informe?.peRatio) || undefined,
      eps: parseFloat(analisisResult.data.informe?.eps) || undefined,
      dividendYield: parseFloat(analisisResult.data.informe?.dividendYield) || undefined,
      week52High: parseFloat(analisisResult.data.informe?.week52High) || undefined,
      week52Low: parseFloat(analisisResult.data.informe?.week52Low) || undefined,
      recommendation: analisisResult.data.informe?.recommendation || undefined,
      targetPrice: parseFloat(analisisResult.data.informe?.targetPrice) || undefined,
      analystRating: analisisResult.data.informe?.analystRating || undefined,
      performance: {
        day1: parseFloat(analisisResult.data.informe?.performance?.day1) || undefined,
        week1: parseFloat(analisisResult.data.informe?.performance?.week1) || undefined,
        month1: parseFloat(analisisResult.data.informe?.performance?.month1) || undefined,
        month3: parseFloat(analisisResult.data.informe?.performance?.month3) || undefined,
        month6: parseFloat(analisisResult.data.informe?.performance?.month6) || undefined,
        year1: parseFloat(analisisResult.data.informe?.performance?.year1) || undefined,
        ytd: parseFloat(analisisResult.data.informe?.performance?.ytd) || undefined
      }
    } : null

    const performanceData: StockPerformanceData | null = analisisResult.data ? {
      day1: parseFloat(analisisResult.data.informe?.performance?.day1) || undefined,
      week1: parseFloat(analisisResult.data.informe?.performance?.week1) || undefined,
      month1: parseFloat(analisisResult.data.informe?.performance?.month1) || undefined,
      month3: parseFloat(analisisResult.data.informe?.performance?.month3) || undefined,
      month6: parseFloat(analisisResult.data.informe?.performance?.month6) || undefined,
      year1: parseFloat(analisisResult.data.informe?.performance?.year1) || undefined,
      ytd: parseFloat(analisisResult.data.informe?.performance?.ytd) || undefined
    } : null

    return {
      basicData,
      analysisData,
      performanceData,
      errors: {
        datos: datosResult.error,
        analisis: analisisResult.error
      }
    }
  } catch (error) {
    console.error('Error in getCompleteStockData:', error)
    return {
      basicData: null,
      analysisData: null,
      performanceData: null,
      errors: { datos: error, analisis: error }
    }
  }
}

// Función para obtener solo campos específicos (más eficiente)
export async function getSpecificStockFields(symbol: string, fields: string[]) {
  try {
    const selectFields = fields.map(field => `datos->>'${field}' as ${field}`).join(', ')
    
    const { data, error } = await supabase
      .from('datos_accion')
      .select(`symbol, ${selectFields}`)
      .eq('symbol', symbol.toUpperCase())
      .order('fecha_de_creacion', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching specific fields:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getSpecificStockFields:', error)
    return null
  }
}

// Función para registrar una búsqueda
export async function registerStockSearch(symbol: string) {
  try {
    // Registrar búsqueda independientemente de si está en datos_accion
    const { data: existingData, error: selectError } = await supabase
      .from('busquedas_acciones')
      .select('symbol, busquedas')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (existingData) {
      // Actualizar contador existente
      const { error: updateError } = await supabase
        .from('busquedas_acciones')
        .update({ 
          busquedas: existingData.busquedas + 1,
          ultima_busqueda: new Date().toISOString()
        })
        .eq('symbol', symbol.toUpperCase());
    } else {
      // Crear nuevo registro
      const { error: insertError } = await supabase
        .from('busquedas_acciones')
        .insert({
          symbol: symbol.toUpperCase(),
          busquedas: 1,
          ultima_busqueda: new Date().toISOString()
        });
    }
  } catch (error) {
    console.error('Error in registerStockSearch:', error);
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 *  Tipos para Proyecciones
 * ────────────────────────────────────────────────────────────────────────────── */
export type StockProyeccionRow = {
  symbol: string;
  fecha_de_creacion: string; // timestamptz
  proyeccion: any;           // jsonb que guardás desde n8n
};

interface StockProyeccionData {
  symbol: string;
  empresa: string;
  proyecciones: {
    eps: {
      "1Y": { base: number; conservador: number; optimista: number };
      "3Y": { base: number; conservador: number; optimista: number };
      "5Y": { base: number; conservador: number; optimista: number };
    };
    ingresos: {
      "1Y": { base: number; conservador: number; optimista: number };
      "3Y": { base: number; conservador: number; optimista: number };
      "5Y": { base: number; conservador: number; optimista: number };
    };
    netIncome: {
      "1Y": { base: number; conservador: number; optimista: number };
      "3Y": { base: number; conservador: number; optimista: number };
      "5Y": { base: number; conservador: number; optimista: number };
    };
  };
  valoracion_futura: {
    precio_objetivo_12m: { base: number; conservador: number; optimista: number } | number;
    metodo: string;
    estado_actual: string;
  };
  inferencia_historica: {
    fair_value_actual: number;
    precio_actual: number;
    upside_potencial: string;
  };
  drivers_crecimiento: {
    principales: string[];
    riesgos: string[];
  };
  resumen_llm: string;
  comparacion_analistas: {
    consenso_precio_objetivo: number;
    opinion_promedio: string;
    cantidad_analistas: number;
  };
  rating_futuro_ia: number;
  riesgo: string;
}

/* ──────────────────────────────────────────────────────────────────────────────
 *  Obtener la ÚLTIMA proyección por símbolo desde stock_proyecciones
 * ────────────────────────────────────────────────────────────────────────────── */
export async function getStockProyecciones(symbol: string): Promise<StockProyeccionData | null> {
  const { data, error } = await supabase
    .from('stock_proyecciones')
    .select('symbol, fecha_de_creacion, proyeccion')
    .eq('symbol', symbol)
    .order('fecha_de_creacion', { ascending: false })
    .limit(1)
    .maybeSingle<StockProyeccionRow>();

  if (error) {
    console.error('getStockProyecciones error', error);
    return null;
  }
  if (!data) return null;

  // El jsonb “proyeccion” es exactamente lo que guardaste en n8n
  const p = data.proyeccion ?? {};

  return {
    symbol: data.symbol,
    empresa: p?.empresa,                 // si lo incluís en el payload
    proyecciones: p?.proyecciones,
    valoracion_futura: p?.valoracion_futura,
    inferencia_historica: p?.inferencia_historica,
    drivers_crecimiento: p?.drivers_crecimiento,
    comparacion_analistas: p?.comparacion_analistas,
    rating_futuro_ia: p?.rating_futuro_ia,
    riesgo: p?.riesgo ?? 'amarillo',
    resumen_llm: p?.resumen_llm,
  };
}