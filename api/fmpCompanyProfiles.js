import { ensureArray, API_KEY } from './fmpConfig.js';

export async function getCompanyProfile(symbol) {
  const url = `https://financialmodelingprep.com/api/v3/profile/${encodeURIComponent(symbol)}?apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP profile: ${res.status}`);
  const data = await res.json();
  const arr = ensureArray(data);
  if (!arr.length) throw new Error('No se encontró información para el símbolo');
  return arr[0];
}

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