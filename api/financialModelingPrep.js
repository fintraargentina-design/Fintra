// Financial Modeling Prep API Service (JS puro)

const API_KEY = process.env.NEXT_PUBLIC_FMP_API_KEY;
const BASE_URL = process.env.NEXT_PUBLIC_FMP_BASE_URL; // ej: "https://financialmodelingprep.com/stable"

if (!API_KEY || !BASE_URL) {
  throw new Error('Las variables NEXT_PUBLIC_FMP_API_KEY y NEXT_PUBLIC_FMP_BASE_URL deben estar configuradas');
}

function buildUrl(path, params = {}) {
  const base = (BASE_URL || "").replace(/\/+$/, "");         // sin slash final
  const cleanPath = String(path).replace(/^\/+/, "");        // sin slash inicial
  const u = new URL(`${base}/${cleanPath}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  });
  u.searchParams.set('apikey', API_KEY);
  return u.toString();
}

function ensureArray(val) {
  return Array.isArray(val) ? val : [];
}

function sortByDateDesc(arr) {
  return [...arr].sort((a, b) => {
    const da = a?.date ? new Date(a.date).getTime() : 0;
    const db = b?.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
}

// 1) Históricos
export async function getHistoricalPrices(symbol, opts = { period: 'full' }) {
  const { period = 'full', from, to } = opts;

  const urlStable = buildUrl(`historical-price-eod/${period}`, { symbol, from, to });
  let res = await fetch(urlStable);
  if (res.ok) {
    const data = await res.json();
    const arr = ensureArray(data);
    if (arr.length) return sortByDateDesc(arr);
  }

  const urlV3 = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(
    symbol
  )}?apikey=${API_KEY}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`;

  res = await fetch(urlV3);
  if (!res.ok) throw new Error(`Error HTTP histórico: ${res.status}`);
  const dataV3 = await res.json();
  const hist = ensureArray(dataV3?.historical);
  if (!hist.length) throw new Error('No se encontraron datos históricos');
  return sortByDateDesc(hist);
}

export async function getLatestPrice(symbol) {
  const url = `https://financialmodelingprep.com/api/v3/quote-short/${encodeURIComponent(symbol)}?apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP quote: ${res.status}`);
  const arr = await res.json(); // [{ symbol, price, volume }]
  if (!Array.isArray(arr) || !arr[0]) throw new Error('Sin quote para el símbolo');
  return arr[0];
}

export async function getMultipleHistoricalPrices(symbols, opts = { period: 'full' }) {
  const promises = symbols.map((s) =>
    getHistoricalPrices(s, opts)
      .then((data) => ({ symbol: s, data }))
      .catch((e) => ({ symbol: s, error: e?.message || String(e) }))
  );
  const results = await Promise.all(promises);
  return results.reduce((acc, r) => {
    acc[r.symbol] = r.data ?? { error: r.error };
    return acc;
  }, {});
}

export function formatPriceDataForChart(priceData) {
  return priceData.map((d) => ({
    date: d.date,
    price: d.close,
    open: d.open,
    high: d.high,
    low: d.low,
    volume: d.volume,
    change: d.change ?? d.changes ?? null,
    changePercent: d.changePercent ?? d.changesPercentage ?? null,
  }));
}

export function calculatePriceStatistics(priceData) {
  if (!Array.isArray(priceData) || priceData.length === 0) return null;
  const closes = priceData.map((x) => x.close).filter((x) => typeof x === 'number');
  const volumes = priceData.map((x) => x.volume).filter((x) => typeof x === 'number');
  if (!closes.length) return null;

  const currentPrice = closes[0];
  const highestPrice = Math.max(...closes);
  const lowestPrice = Math.min(...closes);
  const averagePrice = closes.reduce((a, b) => a + b, 0) / closes.length;
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  const averageVolume = volumes.length ? totalVolume / volumes.length : 0;

  return {
    currentPrice,
    highestPrice,
    lowestPrice,
    averagePrice,
    totalVolume,
    averageVolume,
    priceRange: highestPrice - lowestPrice,
    dataPoints: priceData.length,
  };
}

// 2) Profiles
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
  const comma = symbols.join(','); // NO encodeURIComponent acá
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

// 3) Peers
export async function getStockPeers(symbol) {
  const url = `https://financialmodelingprep.com/api/v4/stock_peers?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP peers: ${res.status}`);
  const data = await res.json();
  const peersList = data?.peersList ?? data?.[0]?.peersList ?? [];
  if (!Array.isArray(peersList) || !peersList.length) throw new Error('No se encontraron competidores para el símbolo');
  return peersList.map((s) => ({ symbol: s }));
}

export async function getDetailedStockPeers(symbol, includeProfiles = false) {
  const peers = await getStockPeers(symbol);
  if (!includeProfiles) return { mainSymbol: symbol, peers, totalPeers: peers.length };
  const peerSymbols = peers.map((p) => p.symbol);
  const profiles = await getMultipleCompanyProfiles(peerSymbols);
  const detailedPeers = peers.map((p) => ({ ...p, profile: profiles[p.symbol] ?? null }));
  return { mainSymbol: symbol, peers: detailedPeers, totalPeers: detailedPeers.length, profilesIncluded: true };
}

export async function compareWithPeers(symbol) {
  const mainProfile = await getCompanyProfile(symbol);
  const peersData = await getDetailedStockPeers(symbol, true);
  const validPeers = peersData.peers.filter((p) => p.profile && !p.profile.error);

  if (!validPeers.length) {
    return { mainCompany: mainProfile, peers: [], comparison: null, message: 'No se pudieron obtener datos de competidores' };
  }

  const getNums = (arr, key) =>
    arr.map((x) => Number(x?.profile?.[key])).filter((n) => Number.isFinite(n) && n > 0);

  const mcaps = getNums(validPeers, 'mktCap').concat(getNums(validPeers, 'marketCap'));
  const prices = getNums(validPeers, 'price');
  const betas = validPeers.map((x) => Number(x?.profile?.beta)).filter((n) => Number.isFinite(n));

  const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const comparison = {
    marketCap: {
      main: mainProfile.mktCap ?? mainProfile.marketCap ?? 0,
      peerAverage: avg(mcaps),
      peerMax: mcaps.length ? Math.max(...mcaps) : 0,
      peerMin: mcaps.length ? Math.min(...mcaps) : 0,
      ranking: mcaps.filter((cap) => cap > (mainProfile.mktCap ?? mainProfile.marketCap ?? 0)).length + 1,
    },
    price: {
      main: Number(mainProfile.price) || 0,
      peerAverage: avg(prices),
      peerMax: prices.length ? Math.max(...prices) : 0,
      peerMin: prices.length ? Math.min(...prices) : 0,
    },
    beta: {
      main: Number(mainProfile.beta) || 0,
      peerAverage: avg(betas),
      peerMax: betas.length ? Math.max(...betas) : 0,
      peerMin: betas.length ? Math.min(...betas) : 0,
    },
  };

  return { mainCompany: mainProfile, peers: validPeers, comparison, totalPeersAnalyzed: validPeers.length };
}

export function formatPeersForDisplay(peers) {
  return peers.map((peer) => {
    const mcap = peer.mktCap ?? peer.marketCap ?? peer?.profile?.mktCap ?? peer?.profile?.marketCap;
    const price = peer.price ?? peer?.profile?.price;
    return {
      symbol: peer.symbol,
      companyName: peer.companyName ?? peer?.profile?.companyName ?? peer.symbol,
      price,
      marketCap: mcap,
      marketCapFormatted: formatMarketCap(mcap),
      priceFormatted: typeof price === 'number' ? `$${price.toFixed(2)}` : 'N/A',
    };
  });
}

function formatMarketCap(marketCap) {
  if (!Number.isFinite(Number(marketCap)) || !marketCap) return 'N/A';
  const n = Number(marketCap);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

// === 4) Analyst / Financial Estimates ===

// Trae una página de estimates (annual o quarter)
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
    // Normalizar la respuesta - la API v3 devuelve directamente un array
    return Array.isArray(data) ? data : [];
  }

  // En servidor (SSR/ISR): usar directamente v3 para consistencia
  const urlV3 =
    `https://financialmodelingprep.com/api/v3/analyst-estimates/` +
    `${encodeURIComponent(symbol)}?apikey=${API_KEY}` +
    `${period ? `&period=${period}` : ''}` +
    `${limit ? `&limit=${limit}` : ''}` +
    `&page=${page}`;

  const res = await fetch(urlV3, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Error HTTP estimates: ${res.status} - ${res.statusText}`);
  }
  
  const data = await res.json();
  
  // Validar que la respuesta sea un array
  if (!Array.isArray(data)) {
    console.warn('API response is not an array:', data);
    return [];
  }
  
  if (data.length === 0) {
    console.warn(`No estimates found for symbol: ${symbol}`);
  }
  
  return data;
}


// Pagina automáticamente hasta traer todo (respeta el límite por request)
export async function getAnalystEstimatesAll(symbol, opts = {}) {
  const { period = 'annual', limit = 1000, maxPages = 10 } = opts; // 1000 por request típico
  let page = 0;
  const out = [];
  while (page < maxPages) {
    const batch = await getAnalystEstimates(symbol, { period, page, limit });
    out.push(...batch);
    if (batch.length < limit) break; // última página
    page += 1;
  }
  return out;
}

// Normalizador simple para tabla/UI (toma los campos comunes si existen)
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

    // Otros (si vienen)
    ebitdaAvg: num(r.ebitdaAvg),
    ebitAvg: num(r.ebitAvg),
    netIncomeAvg: num(r.netIncomeAvg),

    // Conteo de analistas (nombres varían)
    numberAnalysts: r.numberAnalysts ?? r.numberOfAnalystEstimated ?? r.analystCount ?? null,
  }));
}


const fmpService = {
  getHistoricalPrices,
  getLatestPrice,
  getMultipleHistoricalPrices,
  getCompanyProfile,
  getMultipleCompanyProfiles,
  extractKeyCompanyInfo,
  getStockPeers,
  getDetailedStockPeers,
  compareWithPeers,
  formatPeersForDisplay,
  formatPriceDataForChart,
  calculatePriceStatistics,
  getAnalystEstimates,
  getAnalystEstimatesAll,
  formatAnalystEstimatesForDisplay,
};

export default fmpService;

//console.log('[FMP] GET', urlStable);