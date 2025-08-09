import { supabase } from '@/lib/supabase';

export interface RadarDimensions {
  rentabilidad: number;
  crecimiento: number;
  solidezFinanciera: number;
  generacionCaja: number;
  margen: number;
  valoracion: number;
  riesgoVolatilidad: number;
  dividendos: number;
}

export interface StockFinancialData {
  roe?: number;
  revenueCAGR_5Y?: number;
  currentRatio?: number;
  interestCoverage?: number;
  debtToEquity?: number;
  freeCashFlow?: number;
  revenue?: number;
  grossMargin?: number;
  netMargin?: number;
  peg?: number;
  beta?: number;
}

/**
 * Obtiene datos financieros de una acción desde Supabase
 */
export async function getStockFinancialData(symbol: string): Promise<StockFinancialData | null> {
  try {
    const { data, error } = await supabase
      .from('datos_accion')
      .select(`
        datos
      `)
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (error || !data) {
      console.error('Error fetching stock data:', error);
      return null;
    }

    const fundamentales = data.datos?.fundamentales;  // Cambiado de 'fundamental' a 'fundamentales'
    const desempeno = data.datos?.desempeno;
    const valoresHistoricos = data.datos?.valoresHistoricos;
    const valoracion = data.datos?.valoracion;

    // Obtener revenue del primer valor histórico si está disponible
    let revenue = fundamentales?.revenue;
    if (!revenue && valoresHistoricos?.revenue && valoresHistoricos.revenue.length > 0) {
      revenue = valoresHistoricos.revenue[0].value;
    }

    // Agregar logs para debugging
    console.log('Datos financieros extraídos:', {
      roe: fundamentales?.roe,
      revenueCAGR_5Y: fundamentales?.revenueCAGR_5Y,
      currentRatio: fundamentales?.currentRatio,
      interestCoverage: fundamentales?.interestCoverage,
      debtToEquity: fundamentales?.debtToEquity,
      freeCashFlow: fundamentales?.freeCashFlow,
      revenue: revenue,
      grossMargin: fundamentales?.grossMargin,
      netMargin: fundamentales?.netMargin,
      peg: valoracion?.peg,
      beta: desempeno?.beta
    });

    return {
      roe: fundamentales?.roe,
      revenueCAGR_5Y: fundamentales?.revenueCAGR_5Y,
      currentRatio: fundamentales?.currentRatio,
      interestCoverage: fundamentales?.interestCoverage,
      debtToEquity: fundamentales?.debtToEquity,
      freeCashFlow: fundamentales?.freeCashFlow,
      revenue: revenue,
      grossMargin: fundamentales?.grossMargin,
      netMargin: fundamentales?.netMargin,
      peg: valoracion?.peg,
      beta: desempeno?.beta
    };
  } catch (error) {
    console.error('Error in getStockFinancialData:', error);
    return null;
  }
}

export function calcularPuntajes(data: StockFinancialData): RadarDimensions {
  console.log('Calculando puntajes con datos:', data);
  
  // Rentabilidad: ROE / 40 * 100, máximo 100
  const roe = data.roe ? Math.min(Math.max((data.roe / 40) * 100, 0), 100) : 0;
  
  // Crecimiento: revenueCAGR_5Y / 30 * 100, máximo 100
  const crecimiento = data.revenueCAGR_5Y ? Math.min(Math.max((data.revenueCAGR_5Y / 30) * 100, 0), 100) : 0;
  
  // Solidez Financiera: combinación de currentRatio, interestCoverage y debtToEquity
  const currentRatio = data.currentRatio || 0;
  const interestCoverage = data.interestCoverage || 0;
  const deudaCapital = data.debtToEquity || 0;
  
  const solidez = Math.min(Math.max(
    ((currentRatio / 2.5) * 30 + 
     (Math.min(interestCoverage / 30, 1)) * 30 + 
     (Math.max(0, (1 - Math.min(deudaCapital / 2, 1))) * 40)), 0
  ), 100);
  
  // Margen: promedio de grossMargin y netMargin (convertir de decimal a porcentaje si es necesario)
  let grossMargin = data.grossMargin || 0;
  let netMargin = data.netMargin || 0;
  
  // Si los márgenes están en decimal (0.1 = 10%), convertir a porcentaje
  if (grossMargin > 0 && grossMargin < 1) grossMargin *= 100;
  if (netMargin > 0 && netMargin < 1) netMargin *= 100;
  
  const margen = Math.min(Math.max((grossMargin + netMargin) / 2, 0), 100);
  
  // Generación de Caja: freeCashFlow / revenue * 100, máximo 100
  const fcf = data.freeCashFlow || 0;
  const revenue = data.revenue || 1; // Evitar división por cero
  const caja = revenue > 0 ? Math.min(Math.max((fcf / revenue) * 100, 0), 100) : 0;
  
  // Valoración: 3 / PEG * 100, máximo 100 (ideal < 1)
  const peg = data.peg || 1;
  const valoracion = peg > 0 ? Math.min(Math.max((3 / peg) * 100, 0), 100) : 0;
  
  // Riesgo/Volatilidad: (2.5 - beta) / 2.5 * 100, entre 0 y 100
  const beta = data.beta || 1;
  const riesgo = Math.min(Math.max((2.5 - beta) / 2.5 * 100, 0), 100);
  
  const result = {
    rentabilidad: roe,
    crecimiento: crecimiento,
    solidezFinanciera: solidez,
    generacionCaja: caja,
    margen: margen,
    valoracion: valoracion,
    riesgoVolatilidad: riesgo
  };
  
  console.log('Puntajes calculados:', result);
  return result;
}

/**
 * Obtiene datos del radar chart desde la tabla radar_analisis de Supabase
 */
export async function getRadarDataFromSupabase(symbol: string): Promise<RadarDimensions | null> {
  try {
    const { data, error } = await supabase
      .from('radar_analisis')
      .select('radarData')
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (error || !data || !data.radarData) {
      console.error('Error fetching radar data:', error);
      return null;
    }

    const radarData = data.radarData;
    
    console.log('Datos del radar obtenidos desde Supabase:', radarData);

    return {
      rentabilidad: radarData["Rentabilidad"] || 0,
      crecimiento: radarData["Crecimiento"] || 0,
      solidezFinanciera: radarData["Solidez Financiera"] || 0,
      generacionCaja: radarData["Generación de Caja"] || 0,
      margen: radarData["Margen"] || 0,
      valoracion: radarData["Valoración"] || 0,
      riesgoVolatilidad: radarData["Riesgo / Volatilidad"] || 0,
      dividendos: radarData["Dividendos"] || 0
    };
  } catch (error) {
    console.error('Error in getRadarDataFromSupabase:', error);
    return null;
  }
}

/**
 * Calcula todas las dimensiones del radar para una acción
 * Ahora obtiene los datos directamente de Supabase
 */
export async function calculateRadarDimensions(symbol: string): Promise<RadarDimensions | null> {
  return await getRadarDataFromSupabase(symbol);
}

/**
 * Convierte las dimensiones a formato para Chart.js radar
 */
export function formatRadarData(dimensions: RadarDimensions, stockName?: string, stockSymbol?: string) {
  // Crear arrays de colores basados en valores negativos/positivos/cero
  const dataValues = [
    dimensions.rentabilidad,
    dimensions.crecimiento,
    dimensions.solidezFinanciera,
    dimensions.generacionCaja,
    dimensions.margen,
    dimensions.valoracion,
    dimensions.riesgoVolatilidad,
    dimensions.dividendos
  ];

  const pointColors = dataValues.map(value => {
    if (value === 0) {
      return "rgba(255, 235, 59, 0.8)"; // Amarillo suave para valores 0
    } else if (value < 0) {
      return "rgba(255, 99, 99, 0.8)"; // Rojo para valores negativos
    } else {
      return "rgba(75, 192, 192, 1)"; // Verde/azul para valores positivos
    }
  });

  const borderColors = dataValues.map(value => {
    if (value === 0) {
      return "rgba(255, 235, 59, 1)"; // Amarillo suave para bordes de valores 0
    } else if (value < 0) {
      return "rgba(255, 99, 99, 1)"; // Rojo para bordes de valores negativos
    } else {
      return "rgba(75, 192, 192, 1)"; // Verde/azul para bordes de valores positivos
    }
  });

  return {
    labels: [
      "Rentabilidad",
      "Crecimiento", 
      "Solidez Financiera",
      "Generación de Caja",
      "Margen",
      "Valoración",
      "Riesgo / Volatilidad",
      "Dividendos"
    ],
    datasets: [{
      label: stockName || stockSymbol || 'Stock',
      data: dataValues,
      fill: true,
      backgroundColor: "rgba(75,192,192,0.2)",
      borderColor: "rgba(75,192,192,1)",
      pointBackgroundColor: pointColors,
      pointBorderColor: borderColors,
      pointRadius: 6,
      pointHoverRadius: 8
    }]
  };
}

/**
 * Función principal que obtiene los datos desde Supabase y los formatea
 */
export async function calcularPuntajesCompleto(symbol: string) {
  const radarData = await getRadarDataFromSupabase(symbol);
  
  if (!radarData) {
    return null;
  }

  return formatRadarData(radarData, undefined, symbol);
}