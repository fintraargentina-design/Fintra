import { buildUrl } from './fmpConfig';

const BASE_URL = 'https://financialmodelingprep.com/stable';

// Tipos para earnings
interface EarningsData {
  symbol: string;
  date: string;
  time?: string;
  eps?: number;
  epsEstimated?: number;
  revenue?: number;
  revenueEstimated?: number;
  fiscalDateEnding?: string;
  reportedDate?: string;
  reportedEPS?: number;
  estimatedEPS?: number;
  actualEPS?: number;
  surprise?: number;
  surprisePercentage?: number;
}

interface EarningsResponse {
  data: EarningsData[];
  error?: string;
}

interface EarningsCalendarData {
  symbol: string;
  date: string;
  time?: string;
  eps?: number;
  epsEstimated?: number;
  revenue?: number;
  revenueEstimated?: number;
}

interface FormattedEarnings {
  symbol: string;
  date: string;
  reportedEPS: number | null;
  estimatedEPS: number | null;
  surprise: number | null;
  surprisePercentage: number | null;
  revenue: number | null;
  revenueEstimated: number | null;
}

interface EarningsAccuracy {
  totalReports: number;
  accurateReports: number;
  accuracyPercentage: number;
  averageSurprise: number;
  averageSurprisePercentage: number;
}

/**
 * Obtiene los datos de earnings para un símbolo específico
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @returns Promise con los datos de earnings
 */
export async function getEarnings(symbol: string): Promise<EarningsResponse> {
  try {
    const url = buildUrl(`${BASE_URL}/earnings`, { symbol });
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EarningsData[] = await response.json();
    return { data };
  } catch (error) {
    console.error(`Error fetching earnings for ${symbol}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene el calendario de earnings
 * @param from - Fecha de inicio (opcional, formato YYYY-MM-DD)
 * @param to - Fecha de fin (opcional, formato YYYY-MM-DD)
 * @returns Promise con los datos del calendario de earnings
 */
export async function getEarningsCalendar(
  from?: string, 
  to?: string
): Promise<EarningsResponse> {
  try {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    
    const url = buildUrl(`${BASE_URL}/earnings-calendar`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EarningsCalendarData[] = await response.json();
    return { data };
  } catch (error) {
    console.error('Error fetching earnings calendar:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene datos de earnings en un rango de fechas
 * @param symbol - Símbolo de la acción
 * @param from - Fecha de inicio
 * @param to - Fecha de fin
 * @returns Promise con los datos de earnings
 */
export async function getEarningsData(
  symbol: string, 
  from: string, 
  to: string
): Promise<EarningsResponse> {
  try {
    const url = buildUrl(`${BASE_URL}/earnings`, { symbol, from, to });
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: EarningsData[] = await response.json();
    return { data };
  } catch (error) {
    console.error(`Error fetching earnings data for ${symbol}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Formatea los datos de earnings para mostrar
 * @param earningsData - Datos de earnings sin procesar
 * @returns Datos formateados
 */
export function formatEarningsForDisplay(
  earningsData: EarningsData[]
): FormattedEarnings[] {
  const num = (x: unknown): number | null => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };

  return earningsData.map(earning => ({
    symbol: earning.symbol,
    date: earning.date || earning.fiscalDateEnding || '',
    reportedEPS: num(earning.reportedEPS ?? earning.actualEPS ?? earning.eps),
    estimatedEPS: num(earning.estimatedEPS ?? earning.epsEstimated),
    surprise: num(earning.surprise),
    surprisePercentage: num(earning.surprisePercentage),
    revenue: num(earning.revenue),
    revenueEstimated: num(earning.revenueEstimated)
  }));
}

/**
 * Obtiene próximos earnings para un símbolo
 * @param symbol - Símbolo de la acción
 * @returns Promise con próximos earnings
 */
export async function getUpcomingEarnings(symbol: string): Promise<EarningsResponse> {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setMonth(today.getMonth() + 3); // Próximos 3 meses
    
    const from = today.toISOString().split('T')[0];
    const to = futureDate.toISOString().split('T')[0];
    
    const calendar = await getEarningsCalendar(from, to);
    
    if (calendar.error) {
      return calendar;
    }
    
    const symbolEarnings = calendar.data.filter(
      (earning: any) => earning.symbol === symbol.toUpperCase()
    );
    
    return {
      data: symbolEarnings
    };
  } catch (error) {
    console.error(`Error fetching upcoming earnings for ${symbol}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Calcula la precisión de las estimaciones de earnings
 * @param earningsData - Datos históricos de earnings
 * @returns Métricas de precisión
 */
export function calculateEarningsAccuracy(
  earningsData: EarningsData[]
): EarningsAccuracy {
  const validData = earningsData.filter(earning => 
    earning.reportedEPS !== undefined && 
    earning.estimatedEPS !== undefined &&
    earning.reportedEPS !== null &&
    earning.estimatedEPS !== null
  );
  
  if (validData.length === 0) {
    return {
      totalReports: 0,
      accurateReports: 0,
      accuracyPercentage: 0,
      averageSurprise: 0,
      averageSurprisePercentage: 0
    };
  }
  
  const accurateReports = validData.filter(earning => {
    const reported = Number(earning.reportedEPS);
    const estimated = Number(earning.estimatedEPS);
    const tolerance = 0.05; // 5% de tolerancia
    return Math.abs(reported - estimated) / Math.abs(estimated) <= tolerance;
  }).length;
  
  const totalSurprise = validData.reduce((sum, earning) => {
    const reported = Number(earning.reportedEPS || 0);
    const estimated = Number(earning.estimatedEPS || 0);
    return sum + (reported - estimated);
  }, 0);
  
  const totalSurprisePercentage = validData.reduce((sum, earning) => {
    const reported = Number(earning.reportedEPS || 0);
    const estimated = Number(earning.estimatedEPS || 0);
    if (estimated === 0) return sum;
    return sum + ((reported - estimated) / estimated * 100);
  }, 0);
  
  return {
    totalReports: validData.length,
    accurateReports,
    accuracyPercentage: (accurateReports / validData.length) * 100,
    averageSurprise: totalSurprise / validData.length,
    averageSurprisePercentage: totalSurprisePercentage / validData.length
  };
}

// Exportar tipos
export type {
  EarningsData,
  EarningsResponse,
  EarningsCalendarData,
  FormattedEarnings,
  EarningsAccuracy
};