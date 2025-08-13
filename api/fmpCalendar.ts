// API functions for FMP Calendar data (Dividends, Earnings, Stock Splits)
import { buildUrl, ensureArray, sortByDateDesc } from './fmpConfig';

// ===== TIPOS =====

interface DividendData {
  symbol: string;
  date: string;
  dividend: number;
  recordDate?: string;
  paymentDate?: string;
  declarationDate?: string;
}

interface EarningsData {
  symbol: string;
  date: string;
  time?: string;
  eps?: number;
  epsEstimated?: number;
  revenue?: number;
  revenueEstimated?: number;
}

interface StockSplitData {
  symbol: string;
  date: string;
  numerator: number;
  denominator: number;
  description?: string;
}

interface CalendarResponse<T> {
  data: T[];
  symbol?: string;
  from?: string;
  to?: string;
  lastUpdated: string;
  error?: string;
}

interface CombinedCalendarData {
  symbol: string;
  dividends: CalendarResponse<DividendData>;
  earnings: CalendarResponse<EarningsData>;
  splits: CalendarResponse<StockSplitData>;
  lastUpdated: string;
}

interface UpcomingCalendarEvents {
  from: string;
  to: string;
  dividends: CalendarResponse<DividendData>;
  earnings: CalendarResponse<EarningsData>;
  splits: CalendarResponse<StockSplitData>;
  lastUpdated: string;
}

interface FormattedDividends {
  totalDividends: number;
  annualDividend: number;
  dividendYield: number;
  paymentFrequency: string;
  lastPayment: {
    date: string;
    amount: number;
    recordDate?: string;
    paymentDate?: string;
  } | null;
  nextPayment: any | null;
  growthRate: number;
  history: Array<{
    date: string;
    amount: number;
    recordDate?: string;
    paymentDate?: string;
  }>;
}

interface FormattedSplits {
  totalSplits: number;
  lastSplit: {
    date: string;
    ratio: string;
    description?: string;
  } | null;
  history: Array<{
    date: string;
    ratio: string;
    description?: string;
  }>;
}

// ===== DIVIDENDS =====

/**
 * Get historical dividends for a specific symbol
 * @param symbol - Stock symbol (e.g., 'AAPL')
 * @returns Dividends data
 */
export async function getDividends(symbol: string): Promise<CalendarResponse<DividendData>> {
  try {
    const url = buildUrl(`/stable/dividends`, { symbol });
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return {
      data: ensureArray(data),
      symbol,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching dividends for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get upcoming dividends calendar
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 * @returns Dividends calendar data
 */
export async function getDividendsCalendar(
  from?: string, 
  to?: string
): Promise<CalendarResponse<DividendData>> {
  try {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    
    const url = buildUrl('/stable/dividends-calendar', params);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return {
      data: ensureArray(data),
      from,
      to,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching dividends calendar:', error);
    throw error;
  }
}

// ===== EARNINGS =====

/**
 * Get historical earnings for a specific symbol
 * @param symbol - Stock symbol (e.g., 'AAPL')
 * @param limit - Number of results to return
 * @returns Earnings data
 */
export async function getEarningsHistory(
  symbol: string, 
  limit: number = 40
): Promise<CalendarResponse<EarningsData>> {
  try {
    const url = buildUrl('/stable/earnings', { symbol, limit: limit.toString() });
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return {
      data: ensureArray(data),
      symbol,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching earnings history for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get upcoming earnings calendar
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 * @returns Earnings calendar data
 */
export async function getEarningsCalendar(
  from?: string, 
  to?: string
): Promise<CalendarResponse<EarningsData>> {
  try {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    
    const url = buildUrl('/stable/earnings-calendar', params);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return {
      data: ensureArray(data),
      from,
      to,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching earnings calendar:', error);
    throw error;
  }
}

// ===== STOCK SPLITS =====

/**
 * Get historical stock splits for a specific symbol
 * @param symbol - Stock symbol (e.g., 'AAPL')
 * @returns Stock splits data
 */
export async function getStockSplits(symbol: string): Promise<CalendarResponse<StockSplitData>> {
  try {
    const url = buildUrl('/stable/splits', { symbol });
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return {
      data: ensureArray(data),
      symbol,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching stock splits for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get upcoming stock splits calendar
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 * @returns Stock splits calendar data
 */
export async function getStockSplitsCalendar(
  from?: string, 
  to?: string
): Promise<CalendarResponse<StockSplitData>> {
  try {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    
    const url = buildUrl('/stable/splits-calendar', params);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return {
      data: ensureArray(data),
      from,
      to,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching stock splits calendar:', error);
    throw error;
  }
}

// ===== COMBINED FUNCTIONS =====

/**
 * Get all calendar data for a specific symbol
 * @param symbol - Stock symbol
 * @returns Combined calendar data
 */
export async function getSymbolCalendarData(symbol: string): Promise<CombinedCalendarData> {
  try {
    const [dividends, earnings, splits] = await Promise.allSettled([
      getDividends(symbol),
      getEarningsHistory(symbol),
      getStockSplits(symbol)
    ]);
    
    return {
      symbol,
      dividends: dividends.status === 'fulfilled' ? dividends.value : { data: [], error: dividends.reason?.message, lastUpdated: new Date().toISOString() },
      earnings: earnings.status === 'fulfilled' ? earnings.value : { data: [], error: earnings.reason?.message, lastUpdated: new Date().toISOString() },
      splits: splits.status === 'fulfilled' ? splits.value : { data: [], error: splits.reason?.message, lastUpdated: new Date().toISOString() },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching calendar data for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get upcoming calendar events
 * @param from - Start date (YYYY-MM-DD)
 * @param to - End date (YYYY-MM-DD)
 * @returns Combined upcoming calendar data
 */
export async function getUpcomingCalendarEvents(
  from: string, 
  to: string
): Promise<UpcomingCalendarEvents> {
  try {
    const [dividendsCalendar, earningsCalendar, splitsCalendar] = await Promise.allSettled([
      getDividendsCalendar(from, to),
      getEarningsCalendar(from, to),
      getStockSplitsCalendar(from, to)
    ]);
    
    return {
      from,
      to,
      dividends: dividendsCalendar.status === 'fulfilled' ? dividendsCalendar.value : { data: [], error: dividendsCalendar.reason?.message, lastUpdated: new Date().toISOString() },
      earnings: earningsCalendar.status === 'fulfilled' ? earningsCalendar.value : { data: [], error: earningsCalendar.reason?.message, lastUpdated: new Date().toISOString() },
      splits: splitsCalendar.status === 'fulfilled' ? splitsCalendar.value : { data: [], error: splitsCalendar.reason?.message, lastUpdated: new Date().toISOString() },
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching upcoming calendar events:', error);
    throw error;
  }
}

// ===== FORMATTING FUNCTIONS =====

/**
 * Format dividends data for display
 * @param dividendsData - Raw dividends data
 * @returns Formatted dividends data
 */
export function formatDividendsForDisplay(
  dividendsData: CalendarResponse<DividendData>
): FormattedDividends {
  const data = dividendsData?.data || [];
  
  if (!Array.isArray(data) || data.length === 0) {
    return {
      totalDividends: 0,
      annualDividend: 0,
      dividendYield: 0,
      paymentFrequency: 'N/A',
      lastPayment: null,
      nextPayment: null,
      growthRate: 0,
      history: []
    };
  }
  
  const sortedData = sortByDateDesc(data);
  const currentYear = new Date().getFullYear();
  const currentYearDividends = sortedData.filter(d => 
    new Date(d.date).getFullYear() === currentYear
  );
  
  const annualDividend = currentYearDividends.reduce((sum, d) => sum + (d.dividend || 0), 0);
  const lastPayment = sortedData[0];
  
  // Calculate growth rate (comparing last 2 years)
  const lastYearDividends = sortedData.filter(d => 
    new Date(d.date).getFullYear() === currentYear - 1
  );
  const lastYearTotal = lastYearDividends.reduce((sum, d) => sum + (d.dividend || 0), 0);
  const growthRate = lastYearTotal > 0 ? ((annualDividend - lastYearTotal) / lastYearTotal) * 100 : 0;
  
  return {
    totalDividends: data.length,
    annualDividend: Number(annualDividend.toFixed(4)),
    dividendYield: 0, // Would need current price to calculate
    paymentFrequency: currentYearDividends.length > 0 ? `${currentYearDividends.length}x/year` : 'N/A',
    lastPayment: lastPayment ? {
      date: lastPayment.date,
      amount: lastPayment.dividend,
      recordDate: lastPayment.recordDate,
      paymentDate: lastPayment.paymentDate
    } : null,
    nextPayment: null, // Would need calendar data
    growthRate: Number(growthRate.toFixed(2)),
    history: sortedData.slice(0, 10).map(d => ({
      date: d.date,
      amount: d.dividend,
      recordDate: d.recordDate,
      paymentDate: d.paymentDate
    }))
  };
}

/**
 * Format stock splits data for display
 * @param splitsData - Raw splits data
 * @returns Formatted splits data
 */
export function formatSplitsForDisplay(
  splitsData: CalendarResponse<StockSplitData>
): FormattedSplits {
  const data = splitsData?.data || [];
  
  if (!Array.isArray(data) || data.length === 0) {
    return {
      totalSplits: 0,
      lastSplit: null,
      history: []
    };
  }
  
  const sortedData = sortByDateDesc(data);
  const lastSplit = sortedData[0];
  
  return {
    totalSplits: data.length,
    lastSplit: lastSplit ? {
      date: lastSplit.date,
      ratio: `${lastSplit.numerator}:${lastSplit.denominator}`,
      description: lastSplit.description
    } : null,
    history: sortedData.map(s => ({
      date: s.date,
      ratio: `${s.numerator}:${s.denominator}`,
      description: s.description
    }))
  };
}

// Exportar tipos
export type {
  DividendData,
  EarningsData,
  StockSplitData,
  CalendarResponse,
  CombinedCalendarData,
  UpcomingCalendarEvents,
  FormattedDividends,
  FormattedSplits
};