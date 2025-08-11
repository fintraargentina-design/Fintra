import { API_KEY } from './fmpConfig.js';

export async function getAnalystEstimates(symbol, opts = {}) {
  const { period = 'annual', page = 0, limit = 10 } = opts;

  // En el navegador: usa la API local para evitar CORS
  if (typeof window !== 'undefined') {
    const qs = new URLSearchParams({
      symbol,
      period,
      page: String(page),
      limit: String(limit),
    });
    const res = await fetch(`/api/fmp/analyst-estimates?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`API estimates local: ${res.status} - ${errorData.error || 'Unknown error'}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  // En servidor: usar https nativo para mayor confiabilidad
  return new Promise((resolve, reject) => {
    const https = require('https');
    
    const path = `/api/v3/analyst-estimates/${encodeURIComponent(symbol)}?apikey=${API_KEY}&period=${period}&page=${page}&limit=${limit}`;
    
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
          reject(new Error(`Error parsing JSON: ${error.message}`));
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

export async function getAnalystEstimatesAll(symbol, opts = {}) {
  const { period = 'annual', limit = 1000, maxPages = 10 } = opts;
  let page = 0;
  const out = [];
  while (page < maxPages) {
    const batch = await getAnalystEstimates(symbol, { period, page, limit });
    out.push(...batch);
    if (batch.length < limit) break;
    page += 1;
  }
  return out;
}

export function formatAnalystEstimatesForDisplay(rows = []) {
  const num = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
  };
  return rows.map((r) => ({
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

    // Otros
    ebitdaAvg: num(r.ebitdaAvg),
    ebitAvg: num(r.ebitAvg),
    netIncomeAvg: num(r.netIncomeAvg),

    // Conteo de analistas
    numberAnalysts: r.numberAnalysts ?? r.numberOfAnalystEstimated ?? r.analystCount ?? null,
  }));
}