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
export async function getCompleteStockData(symbol: string) {
  try {
    const [datosResult, analisisResult] = await Promise.all([
      // Obtener datos básicos con claves específicas
      supabase
        .from('datos_accion')
        .select(`
          symbol,
          fecha_de_creacion,
          datos->>'name' as name,
          datos->>'price' as price,
          datos->>'change' as change,
          datos->>'changePercent' as changePercent,
          datos->'desempeno'->>'averageVolume' as volume,
          datos->>'high' as high,
          datos->>'low' as low,
          datos->>'open' as open,
          datos->>'close' as close,
          datos->'valoracion'->>'marketCap' as marketCap,
          datos->>'industry' as industry,
          datos->>'country' as country,
          datos->>'sector' as sector,
          datos->>'exchange' as exchange,
          datos->'valoracion'->>'pe' as peRatio,
          datos->>'website' as website,
          datos->>'description' as description,
          datos->>'moat' as competitive_advantage,
          datos->>'isEasy' as business_complexity,
          datos->'dividendos' as dividendos_data,
          datos->'valoracion' as valoracion_data
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
          informe->>'peRatio' as peRatio,
          informe->>'eps' as eps,
          informe->>'dividendYield' as dividendYield,
          informe->>'week52High' as week52High,
          informe->>'week52Low' as week52Low,
          informe->>'recommendation' as recommendation,
          informe->>'targetPrice' as targetPrice,
          informe->>'analystRating' as analystRating,
          informe->'performance'->>'day1' as perf_day1,
          informe->'performance'->>'week1' as perf_week1,
          informe->'performance'->>'month1' as perf_month1,
          informe->'performance'->>'month3' as perf_month3,
          informe->'performance'->>'month6' as perf_month6,
          informe->'performance'->>'year1' as perf_year1,
          informe->'performance'->>'ytd' as perf_ytd
        `)
        .eq('symbol', symbol.toUpperCase())
        .order('fecha_de_creacion', { ascending: false })
        .limit(1)
        .single()
    ])

    // Procesar y estructurar los datos
    const basicData: StockBasicData | null = datosResult.data ? {
      symbol: datosResult.data.symbol,
      name: datosResult.data.name || symbol,
      price: parseFloat(datosResult.data.price) || 0,
      change: parseFloat(datosResult.data.change) || 0,
      changePercent: parseFloat(datosResult.data.changePercent) || 0,
      volume: parseInt(datosResult.data.volume) || 0,
      high: parseFloat(datosResult.data.high) || 0,
      low: parseFloat(datosResult.data.low) || 0,
      open: parseFloat(datosResult.data.open) || 0,
      close: parseFloat(datosResult.data.close) || 0,
      marketCap: parseInt(datosResult.data.marketCap) || undefined,
      industry: datosResult.data.industry || undefined,
      country: datosResult.data.country || undefined,
      sector: datosResult.data.sector || undefined,
      exchange: datosResult.data.exchange || undefined,
      peRatio: parseFloat(datosResult.data.peRatio) || undefined,
      website: datosResult.data.website || undefined,
      description: datosResult.data.description || undefined,
      competitive_advantage: datosResult.data.competitive_advantage || undefined,
      business_complexity: datosResult.data.business_complexity || undefined,
      dividendos: datosResult.data.dividendos_data || undefined,
      valoracion: datosResult.data.valoracion_data || undefined  // Agregar esta línea
    } : null

    const analysisData: StockAnalysisData | null = analisisResult.data ? {
      peRatio: parseFloat(analisisResult.data.peRatio) || 0,
      eps: parseFloat(analisisResult.data.eps) || 0,
      dividendYield: parseFloat(analisisResult.data.dividendYield) || 0,
      week52High: parseFloat(analisisResult.data.week52High) || 0,
      week52Low: parseFloat(analisisResult.data.week52Low) || 0,
      recommendation: analisisResult.data.recommendation || 'N/A',
      targetPrice: parseFloat(analisisResult.data.targetPrice) || 0,
      analystRating: analisisResult.data.analystRating || 'N/A'
    } : null

    const performanceData: StockPerformanceData | null = analisisResult.data ? {
      day1: parseFloat(analisisResult.data.perf_day1) || 0,
      week1: parseFloat(analisisResult.data.perf_week1) || 0,
      month1: parseFloat(analisisResult.data.perf_month1) || 0,
      month3: parseFloat(analisisResult.data.perf_month3) || 0,
      month6: parseFloat(analisisResult.data.perf_month6) || 0,
      year1: parseFloat(analisisResult.data.perf_year1) || 0,
      ytd: parseFloat(analisisResult.data.perf_ytd) || 0
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
    // PRIMERO: Verificar si el símbolo existe en datos_accion
    const { data: stockExists, error: stockError } = await supabase
      .from('datos_accion')
      .select('symbol')
      .eq('symbol', symbol.toUpperCase())
      .single();

    // Si el símbolo no existe en datos_accion, no registrar la búsqueda
    if (stockError && stockError.code === 'PGRST116') {
      console.log(`Símbolo ${symbol} no encontrado en datos_accion, no se registra la búsqueda`);
      return;
    }

    if (stockError) {
      console.error('Error verificando símbolo en datos_accion:', stockError);
      return;
    }

    // Si llegamos aquí, el símbolo existe en datos_accion
    // Ahora verificar si ya existe en busquedas_acciones
    const { data: existingData, error: selectError } = await supabase
      .from('busquedas_acciones')
      .select('symbol, busquedas')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // Error diferente a "no encontrado"
      console.error('Error checking existing search:', selectError);
      return;
    }

    if (existingData) {
      // Actualizar contador existente
      const { error: updateError } = await supabase
        .from('busquedas_acciones')
        .update({ 
          busquedas: existingData.busquedas + 1,
          ultima_busqueda: new Date().toISOString()
        })
        .eq('symbol', symbol.toUpperCase());

      if (updateError) {
        console.error('Error updating search count:', updateError);
      } else {
        console.log(`Búsqueda actualizada para símbolo válido: ${symbol}`);
      }
    } else {
      // Crear nuevo registro
      const { error: insertError } = await supabase
        .from('busquedas_acciones')
        .insert({
          symbol: symbol.toUpperCase(),
          busquedas: 1,
          ultima_busqueda: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting new search:', insertError);
      } else {
        console.log(`Nueva búsqueda registrada para símbolo válido: ${symbol}`);
      }
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