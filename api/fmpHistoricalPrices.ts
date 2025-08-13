import { buildUrl, ensureArray, sortByDateDesc, API_KEY } from './fmpConfig';

// Type definitions for historical price data
export interface HistoricalPriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose?: number;
  volume: number;
  unadjustedVolume?: number;
  change?: number;
  changes?: number;
  changePercent?: number;
  changesPercentage?: number;
  vwap?: number;
}

export interface HistoricalPriceOptions {
  period?: string;
  from?: string;
  to?: string;
}

export interface LatestQuote {
  symbol: string;
  price: number;
  volume?: number;
}

export interface ChartDataPoint {
  date: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number | null;
  changePercent: number | null;
}

export interface PriceStatistics {
  currentPrice: number;
  highestPrice: number;
  lowestPrice: number;
  averagePrice: number;
  totalVolume: number;
  averageVolume: number;
  priceRange: number;
  dataPoints: number;
}

export interface MultipleHistoricalResult {
  [symbol: string]: HistoricalPriceData[] | { error: string };
}

/**
 * Fetches historical price data for a given symbol
 * @param symbol - Stock symbol to fetch data for
 * @param opts - Options including period, from and to dates
 * @returns Promise resolving to array of historical price data
 * @throws Error if no data is found or API request fails
 */
export async function getHistoricalPrices(
  symbol: string, 
  opts: HistoricalPriceOptions = { period: 'full' }
): Promise<HistoricalPriceData[]> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

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

/**
 * Fetches the latest price quote for a given symbol
 * @param symbol - Stock symbol to fetch quote for
 * @returns Promise resolving to latest quote data
 * @throws Error if quote is not found or API request fails
 */
export async function getLatestPrice(symbol: string): Promise<LatestQuote> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

  const url = `https://financialmodelingprep.com/api/v3/quote-short/${encodeURIComponent(symbol)}?apikey=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP quote: ${res.status}`);
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr[0]) throw new Error('Sin quote para el símbolo');
  return arr[0];
}

/**
 * Fetches historical price data for multiple symbols
 * @param symbols - Array of stock symbols to fetch data for
 * @param opts - Options including period, from and to dates
 * @returns Promise resolving to object with symbol keys and their respective data or errors
 */
export async function getMultipleHistoricalPrices(
  symbols: string[], 
  opts: HistoricalPriceOptions = { period: 'full' }
): Promise<MultipleHistoricalResult> {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('Symbols must be a non-empty array');
  }

  const promises = symbols.map((s) =>
    getHistoricalPrices(s, opts)
      .then((data) => ({ symbol: s, data }))
      .catch((e) => ({ symbol: s, error: e?.message || String(e) }))
  );
  const results = await Promise.all(promises);
  return results.reduce((acc, r) => {
    acc[r.symbol] = r.data ?? { error: r.error };
    return acc;
  }, {} as MultipleHistoricalResult);
}

/**
 * Formats price data for chart display
 * @param priceData - Array of historical price data
 * @returns Array of formatted chart data points
 */
export function formatPriceDataForChart(priceData: HistoricalPriceData[]): ChartDataPoint[] {
  if (!Array.isArray(priceData)) {
    throw new Error('Price data must be an array');
  }

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

/**
 * Calculates statistical information from price data
 * @param priceData - Array of historical price data
 * @returns Price statistics object or null if no valid data
 */
export function calculatePriceStatistics(priceData: HistoricalPriceData[]): PriceStatistics | null {
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