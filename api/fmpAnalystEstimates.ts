import { API_KEY, buildUrl } from './fmpConfig';

// Tipos para las estimaciones de analistas
interface AnalystEstimate {
  symbol: string;
  date?: string;
  calendarYear?: string;
  fiscalDate?: string;
  period?: string;
  fiscalPeriod?: string;
  revenueLow?: number;
  revenueAvg?: number;
  revenueAverage?: number;
  revenueHigh?: number;
  epsLow?: number;
  epsAvg?: number;
  epsAverage?: number;
  epsHigh?: number;
  ebitdaLow?: number;
  ebitdaAvg?: number;
  ebitdaHigh?: number;
  netIncomeLow?: number;
  netIncomeAvg?: number;
  netIncomeHigh?: number;
  numAnalystsRevenue?: number;
  numAnalystsEps?: number;
  numberOfAnalystEstimated?: number;
  analystCount?: number;
}

interface EstimateOptions {
  period?: 'annual' | 'quarter';
  page?: number;
  limit?: number;
}

interface EstimateAllOptions extends EstimateOptions {
  maxPages?: number;
}

interface FormattedEstimate {
  symbol: string;
  date: string | null;
  period: string | null;
  revenueLow: number | null;
  revenueAvg: number | null;
  revenueHigh: number | null;
  epsLow: number | null;
  epsAvg: number | null;
  epsHigh: number | null;
  ebitdaLow: number | null;
  ebitdaAvg: number | null;
  ebitdaHigh: number | null;
  netIncomeLow: number | null;
  netIncomeAvg: number | null;
  netIncomeHigh: number | null;
  numAnalystsRevenue: number | null;
  numAnalystsEps: number | null;
}

/**
 * Obtiene estimaciones de analistas para un símbolo
 * @param symbol - Símbolo de la acción
 * @param opts - Opciones de consulta
 * @returns Promise con las estimaciones
 */
export async function getAnalystEstimates(
  symbol: string, 
  opts: EstimateOptions = {}
): Promise<AnalystEstimate[]> {
  const { period = 'annual', page = 0, limit = 10 } = opts;

  // En el navegador: usar directamente la API de FMP que sabemos que funciona
  if (typeof window !== 'undefined') {
    const url = `https://financialmodelingprep.com/stable/analyst-estimates?symbol=${symbol}&period=${period}&page=${page}&limit=${limit}&apikey=${API_KEY}`;
    
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API estimates: ${res.status} - ${errorData.error || 'Unknown error'}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // En servidor: usar la URL correcta
  return new Promise<AnalystEstimate[]>((resolve, reject) => {
    const https = require('https');
    
    const path = `/stable/analyst-estimates?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}&period=${period}&page=${page}&limit=${limit}`;
    
    const options = {
      hostname: 'financialmodelingprep.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Fintra-App/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP Error: ${res.statusCode} - ${res.statusMessage}`));
            return;
          }
          
          const jsonData = JSON.parse(data);
          
          if (!Array.isArray(jsonData)) {
            console.warn('API response is not an array:', jsonData);
            resolve([]);
            return;
          }
          
          if (jsonData.length === 0) {
            console.warn(`No estimates found for symbol: ${symbol}`);
          }
          
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Error parsing JSON: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request error: ${error.message}`));
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Obtiene todas las estimaciones de analistas con paginación
 * @param symbol - Símbolo de la acción
 * @param opts - Opciones de consulta
 * @returns Promise con todas las estimaciones
 */
export async function getAnalystEstimatesAll(
  symbol: string, 
  opts: EstimateAllOptions = {}
): Promise<AnalystEstimate[]> {
  const { period = 'annual', limit = 1000, maxPages = 10 } = opts;
  let page = 0;
  const out: AnalystEstimate[] = [];
  
  while (page < maxPages) {
    const batch = await getAnalystEstimates(symbol, { period, page, limit });
    out.push(...batch);
    if (batch.length < limit) break;
    page += 1;
  }
  return out;
}

/**
 * Formatea las estimaciones para mostrar
 * @param rows - Array de estimaciones sin procesar
 * @returns Array de estimaciones formateadas
 */
export function formatAnalystEstimatesForDisplay(
  rows: AnalystEstimate[] = []
): FormattedEstimate[] {
  const num = (x: unknown): number | null => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  
  return rows.map((r) => ({
    symbol: r.symbol,
    date: r.date || r.calendarYear || r.fiscalDate || r.period || null,
    period: r.period || r.fiscalPeriod || null,

    // Ingresos
    revenueLow: num(r.revenueLow),
    revenueAvg: num(r.revenueAvg ?? r.revenueAverage),
    revenueHigh: num(r.revenueHigh),

    // EPS
    epsLow: num(r.epsLow),
    epsAvg: num(r.epsAvg ?? r.epsAverage),
    epsHigh: num(r.epsHigh),

    // EBITDA
    ebitdaLow: num(r.ebitdaLow),
    ebitdaAvg: num(r.ebitdaAvg),
    ebitdaHigh: num(r.ebitdaHigh),

    // Net Income
    netIncomeLow: num(r.netIncomeLow),
    netIncomeAvg: num(r.netIncomeAvg),
    netIncomeHigh: num(r.netIncomeHigh),

    // Conteo de analistas
    numAnalystsRevenue: r.numAnalystsRevenue ?? r.numberOfAnalystEstimated ?? r.analystCount ?? null,
    numAnalystsEps: r.numAnalystsEps ?? r.numberOfAnalystEstimated ?? r.analystCount ?? null,
  }));
}

// Exportar tipos
export type {
  AnalystEstimate,
  EstimateOptions,
  EstimateAllOptions,
  FormattedEstimate
};