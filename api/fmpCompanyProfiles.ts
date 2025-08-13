import { ensureArray, API_KEY, type ApiParams } from './fmpConfig';

// Tipos para los perfiles de empresa
interface CompanyProfile {
  symbol: string;
  price: number;
  beta: number;
  volAvg: number;
  mktCap: number;
  lastDiv: number;
  range: string;
  changes: number;
  companyName: string;
  currency: string;
  cik: string;
  isin: string;
  cusip: string;
  exchange: string;
  exchangeShortName: string;
  industry: string;
  website: string;
  description: string;
  ceo: string;
  sector: string;
  country: string;
  fullTimeEmployees: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  dcfDiff: number;
  dcf: number;
  image: string;
  ipoDate: string;
  defaultImage: boolean;
  isEtf: boolean;
  isActivelyTrading: boolean;
  isAdr: boolean;
  isFund: boolean;
}

/**
 * Obtiene el perfil de una empresa
 * @param symbol - Símbolo de la empresa
 * @returns Promise con el perfil de la empresa
 */
export async function getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
  try {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Symbol must be a valid string');
    }

    const url = `https://financialmodelingprep.com/api/v3/profile/${symbol.toUpperCase()}?apikey=${API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: CompanyProfile[] = await response.json();
    const profiles = ensureArray(data);
    
    return profiles.length > 0 ? profiles[0] : null;
  } catch (error) {
    console.error('Error fetching company profile:', error);
    throw error;
  }
}

// Exportar tipos
export type { CompanyProfile };
export async function getMultipleCompanyProfiles(symbols) {
  if (!symbols.length) return {};
  const comma = symbols.join(',');
  const url = `https://financialmodelingprep.com/api/v3/profile/${comma}?apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP profiles: ${res.status}`);
  const data = ensureArray(await res.json());
  const out = {};
  data.forEach((p) => {
    if (p?.symbol) out[p.symbol] = p;
  });
  symbols.forEach((s) => {
    if (!out[s]) out[s] = { error: 'Perfil no disponible' };
  });
  return out;
}

export function extractKeyCompanyInfo(p) {
  if (!p) return null;
  return {
    symbol: p.symbol,
    companyName: p.companyName,
    sector: p.sector,
    industry: p.industry,
    country: p.country,
    price: p.price,
    marketCap: p.mktCap ?? p.marketCap,
    beta: p.beta,
    lastDividend: p.lastDiv ?? p.lastDividend,
    range: p.range,
    change: p.changes ?? p.change,
    changePercentage: p.changesPercentage ?? p.changePercentage,
    volume: p.volume,
    averageVolume: p.volAvg ?? p.averageVolume,
    ceo: p.ceo,
    employees: p.fullTimeEmployees,
    website: p.website,
    description: p.description,
    ipoDate: p.ipoDate,
    exchange: p.exchange,
    exchangeFullName: p.exchangeShortName ?? p.exchangeFullName,
    image: p.image,
  };
}