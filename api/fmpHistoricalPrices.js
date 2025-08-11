import { buildUrl, ensureArray, sortByDateDesc, API_KEY } from './fmpConfig.js';

// Históricos
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
  const arr = await res.json();
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