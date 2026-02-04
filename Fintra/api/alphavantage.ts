// Tipos para Alpha Vantage API
interface StockQuote {
  '01. symbol': string;
  '02. open': string;
  '03. high': string;
  '04. low': string;
  '05. price': string;
  '06. volume': string;
  '07. latest trading day': string;
  '08. previous close': string;
  '09. change': string;
  '10. change percent': string;
}

interface TimeSeriesData {
  [date: string]: {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  };
}

interface DailyTimeSeriesResponse {
  'Meta Data': {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Output Size': string;
    '5. Time Zone': string;
  };
  'Time Series (Daily)': TimeSeriesData;
}

interface CompanyOverview {
  Symbol: string;
  AssetType: string;
  Name: string;
  Description: string;
  CIK: string;
  Exchange: string;
  Currency: string;
  Country: string;
  Sector: string;
  Industry: string;
  Address: string;
  FiscalYearEnd: string;
  LatestQuarter: string;
  MarketCapitalization: string;
  EBITDA: string;
  PERatio: string;
  PEGRatio: string;
  BookValue: string;
  DividendPerShare: string;
  DividendYield: string;
  EPS: string;
  RevenuePerShareTTM: string;
  ProfitMargin: string;
  OperatingMarginTTM: string;
  ReturnOnAssetsTTM: string;
  ReturnOnEquityTTM: string;
  RevenueTTM: string;
  GrossProfitTTM: string;
  DilutedEPSTTM: string;
  QuarterlyEarningsGrowthYOY: string;
  QuarterlyRevenueGrowthYOY: string;
  AnalystTargetPrice: string;
  TrailingPE: string;
  ForwardPE: string;
  PriceToSalesRatioTTM: string;
  PriceToBookRatio: string;
  EVToRevenue: string;
  EVToEBITDA: string;
  Beta: string;
  '52WeekHigh': string;
  '52WeekLow': string;
  '50DayMovingAverage': string;
  '200DayMovingAverage': string;
  SharesOutstanding: string;
  DividendDate: string;
  ExDividendDate: string;
}

interface SearchResult {
  '1. symbol': string;
  '2. name': string;
  '3. type': string;
  '4. region': string;
  '5. marketOpen': string;
  '6. marketClose': string;
  '7. timezone': string;
  '8. currency': string;
  '9. matchScore': string;
}

interface SearchResponse {
  bestMatches: SearchResult[];
}

const API_KEY: string | undefined = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

if (!API_KEY) {
  console.warn('NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY no está configurada');
}

/**
 * Construye URL para Alpha Vantage API
 * @param params - Parámetros de la consulta
 * @returns URL completa
 */
function buildAlphaVantageUrl(params: Record<string, string>): string {
  const url = new URL(BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  url.searchParams.set('apikey', API_KEY || '');
  return url.toString();
}

/**
 * Obtiene cotización actual de una acción
 * @param symbol - Símbolo de la acción
 * @returns Promise con datos de cotización
 */
export async function getStockQuote(symbol: string): Promise<StockQuote | null> {
  try {
    if (!API_KEY) {
      throw new Error('Alpha Vantage API key no configurada');
    }

    const url = buildAlphaVantageUrl({
      function: 'GLOBAL_QUOTE',
      symbol: symbol.toUpperCase()
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data['Global Quote'] || null;
  } catch (error) {
    console.error('Error fetching stock quote:', error);
    throw error;
  }
}

/**
 * Obtiene series temporales diarias
 * @param symbol - Símbolo de la acción
 * @param outputSize - Tamaño de salida ('compact' o 'full')
 * @returns Promise con datos de series temporales
 */
export async function getDailyTimeSeries(
  symbol: string, 
  outputSize: 'compact' | 'full' = 'compact'
): Promise<DailyTimeSeriesResponse | null> {
  try {
    if (!API_KEY) {
      throw new Error('Alpha Vantage API key no configurada');
    }

    const url = buildAlphaVantageUrl({
      function: 'TIME_SERIES_DAILY',
      symbol: symbol.toUpperCase(),
      outputsize: outputSize
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data['Time Series (Daily)'] ? data : null;
  } catch (error) {
    console.error('Error fetching daily time series:', error);
    throw error;
  }
}

/**
 * Obtiene información general de la empresa
 * @param symbol - Símbolo de la empresa
 * @returns Promise con datos de la empresa
 */
export async function getCompanyOverview(symbol: string): Promise<CompanyOverview | null> {
  try {
    if (!API_KEY) {
      throw new Error('Alpha Vantage API key no configurada');
    }

    const url = buildAlphaVantageUrl({
      function: 'OVERVIEW',
      symbol: symbol.toUpperCase()
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.Symbol ? data : null;
  } catch (error) {
    console.error('Error fetching company overview:', error);
    throw error;
  }
}

/**
 * Busca símbolos de acciones
 * @param keywords - Palabras clave de búsqueda
 * @returns Promise con resultados de búsqueda
 */
export async function searchSymbols(keywords: string): Promise<SearchResult[]> {
  try {
    if (!API_KEY) {
      throw new Error('Alpha Vantage API key no configurada');
    }

    const url = buildAlphaVantageUrl({
      function: 'SYMBOL_SEARCH',
      keywords: keywords
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: SearchResponse = await response.json();
    return data.bestMatches || [];
  } catch (error) {
    console.error('Error searching symbols:', error);
    throw error;
  }
}

// Exportar tipos
export type {
  StockQuote,
  TimeSeriesData,
  DailyTimeSeriesResponse,
  CompanyOverview,
  SearchResult,
  SearchResponse
};