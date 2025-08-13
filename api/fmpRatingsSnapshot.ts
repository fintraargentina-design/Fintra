import { API_KEY } from './fmpConfig';

// Type definitions for ratings snapshot data
export interface RatingsSnapshotData {
  symbol: string;
  rating: string;
  overallScore: number;
  discountedCashFlowScore: number;
  returnOnEquityScore: number;
  returnOnAssetsScore: number;
  debtToEquityScore: number;
  priceToEarningsScore: number;
  priceToBookScore: number;
}

export interface FormattedRatingsSnapshot {
  symbol: string;
  rating: string;
  ratingColor: string;
  overallScore: number | null;
  overallScoreColor: string;
  discountedCashFlowScore: number | null;
  discountedCashFlowScoreColor: string;
  returnOnEquityScore: number | null;
  returnOnEquityScoreColor: string;
  returnOnAssetsScore: number | null;
  returnOnAssetsScoreColor: string;
  debtToEquityScore: number | null;
  debtToEquityScoreColor: string;
  priceToEarningsScore: number | null;
  priceToEarningsScoreColor: string;
  priceToBookScore: number | null;
  priceToBookScoreColor: string;
  raw: RatingsSnapshotData;
}

export interface RatingsSnapshotOptions {
  [key: string]: any;
}

/**
 * Obtiene el snapshot de ratings para un símbolo
 * @param symbol - Símbolo de la acción
 * @param opts - Opciones adicionales
 * @returns Promise con los datos de ratings snapshot
 */
export async function getRatingsSnapshot(
  symbol: string, 
  opts: RatingsSnapshotOptions = {}
): Promise<RatingsSnapshotData[]> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

  // En el navegador: usar directamente la API de FMP
  if (typeof window !== 'undefined') {
    const url = `https://financialmodelingprep.com/stable/ratings-snapshot?symbol=${symbol}&apikey=${API_KEY}`;
    
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API ratings snapshot: ${res.status} - ${errorData.error || 'Unknown error'}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // En servidor: usar https nativo
  return new Promise((resolve, reject) => {
    const https = require('https');
    
    const path = `/stable/ratings-snapshot?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
    
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
            console.warn(`No ratings found for symbol: ${symbol}`);
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
 * Obtiene ratings snapshot para múltiples símbolos
 * @param symbols - Array de símbolos
 * @param opts - Opciones adicionales
 * @returns Promise con los datos de ratings snapshot
 */
export async function getRatingsSnapshotMultiple(
  symbols: string[], 
  opts: RatingsSnapshotOptions = {}
): Promise<RatingsSnapshotData[]> {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('Symbols must be a non-empty array');
  }

  const results: RatingsSnapshotData[] = [];
  for (const symbol of symbols) {
    try {
      const data = await getRatingsSnapshot(symbol, opts);
      results.push(...data);
    } catch (error) {
      console.warn(`Error fetching ratings for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  return results;
}

/**
 * Formatea los datos de ratings snapshot para mostrar
 * @param rows - Datos de ratings snapshot
 * @returns Datos formateados con colores y descripciones
 */
export function formatRatingsSnapshotForDisplay(rows: RatingsSnapshotData[] = []): FormattedRatingsSnapshot[] {
  const num = (x: any): number | null => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  
  const getRatingColor = (rating: string): string => {
    switch (rating?.toUpperCase()) {
      case 'A': return 'text-green-500';
      case 'B': return 'text-blue-500';
      case 'C': return 'text-yellow-500';
      case 'D': return 'text-orange-500';
      case 'F': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };
  
  const getScoreColor = (score: number | null): string => {
    if (!score) return 'text-gray-500';
    if (score >= 4) return 'text-green-500';
    if (score >= 3) return 'text-blue-500';
    if (score >= 2) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  return rows.map((r) => ({
    symbol: r.symbol,
    rating: r.rating,
    ratingColor: getRatingColor(r.rating),
    overallScore: num(r.overallScore),
    overallScoreColor: getScoreColor(num(r.overallScore)),
    
    // Scores individuales
    discountedCashFlowScore: num(r.discountedCashFlowScore),
    discountedCashFlowScoreColor: getScoreColor(num(r.discountedCashFlowScore)),
    
    returnOnEquityScore: num(r.returnOnEquityScore),
    returnOnEquityScoreColor: getScoreColor(num(r.returnOnEquityScore)),
    
    returnOnAssetsScore: num(r.returnOnAssetsScore),
    returnOnAssetsScoreColor: getScoreColor(num(r.returnOnAssetsScore)),
    
    debtToEquityScore: num(r.debtToEquityScore),
    debtToEquityScoreColor: getScoreColor(num(r.debtToEquityScore)),
    
    priceToEarningsScore: num(r.priceToEarningsScore),
    priceToEarningsScoreColor: getScoreColor(num(r.priceToEarningsScore)),
    
    priceToBookScore: num(r.priceToBookScore),
    priceToBookScoreColor: getScoreColor(num(r.priceToBookScore)),
    
    // Datos originales para referencia
    raw: r
  }));
}

/**
 * Obtiene la descripción de un rating
 * @param rating - Rating a describir
 * @returns Descripción del rating
 */
export function getRatingDescription(rating: string): string {
  switch (rating?.toUpperCase()) {
    case 'A': return 'Excelente - Inversión muy recomendada';
    case 'B': return 'Buena - Inversión recomendada';
    case 'C': return 'Regular - Inversión neutral';
    case 'D': return 'Pobre - Inversión no recomendada';
    case 'F': return 'Muy Pobre - Evitar inversión';
    default: return 'Sin calificación disponible';
  }
}

/**
 * Obtiene la descripción de un score
 * @param score - Score a describir
 * @returns Descripción del score
 */
export function getScoreDescription(score: number): string {
  if (score >= 4) return 'Excelente';
  if (score >= 3) return 'Bueno';
  if (score >= 2) return 'Regular';
  if (score >= 1) return 'Pobre';
  return 'Muy Pobre';
}