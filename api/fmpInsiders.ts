import { buildUrl } from './fmpConfig';

const BASE_URL = 'https://financialmodelingprep.com/stable';

// Type definitions for insider trading data
export interface InsiderTradingData {
  symbol: string;
  filingDate: string;
  transactionDate: string;
  reportingName: string;
  typeOfOwner: string;
  transactionType: string;
  acquisitionOrDisposition: 'A' | 'D';
  securitiesTransacted: number;
  price: number;
  securitiesOwned: number;
  companyCik: string;
  formType: string;
  link: string;
}

export interface InsiderTradingResponse {
  data: InsiderTradingData[];
  error: string | null;
}

export interface FormattedInsiderTrade extends InsiderTradingData {
  formattedFilingDate: string;
  formattedTransactionDate: string;
  transactionValue: string;
  transactionTypeDescription: string;
  ownerTypeDescription: string;
  isAcquisition: boolean;
  isDisposition: boolean;
  formattedPrice: string;
  formattedSecuritiesTransacted: string;
  formattedSecuritiesOwned: string;
}

export interface InsiderActivity {
  name: string;
  transactions: number;
  totalValue: number;
  typeOfOwner: string;
}

export interface InsiderTradingTrends {
  totalTransactions: number;
  buyTransactions: number;
  sellTransactions: number;
  netSentiment: string;
  totalValue: string;
  netValue: string;
  averageTransactionSize: string;
  mostActiveInsiders: InsiderActivity[];
  recentActivity: string;
  buyToSellRatio: string;
}

export interface InsiderTradingSummary {
  symbol: string;
  lastUpdated: string;
  transactions: FormattedInsiderTrade[];
  trends: InsiderTradingTrends;
  totalTransactions: number;
}

export interface InsiderTradingSummaryResponse {
  error: string | null;
  summary: InsiderTradingSummary | null;
}

/**
 * Obtiene las últimas transacciones de insider trading
 * @param page - Página de resultados (opcional, por defecto 0)
 * @param limit - Límite de resultados por página (opcional, por defecto 100)
 * @returns Promise con los datos de insider trading
 */
export async function getLatestInsiderTrading(
  page: number = 0, 
  limit: number = 100
): Promise<InsiderTradingResponse> {
  try {
    if (page < 0 || limit <= 0) {
      throw new Error('Page must be non-negative and limit must be positive');
    }

    const params = { page, limit };
    
    const url = buildUrl(`${BASE_URL}/insider-trading/latest`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching latest insider trading:', error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene las transacciones de insider trading para un símbolo específico
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @param page - Página de resultados (opcional, por defecto 0)
 * @param limit - Límite de resultados por página (opcional, por defecto 100)
 * @returns Promise con los datos de insider trading del símbolo
 */
export async function getInsiderTradingBySymbol(
  symbol: string, 
  page: number = 0, 
  limit: number = 100
): Promise<InsiderTradingResponse> {
  try {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Symbol must be a non-empty string');
    }
    if (page < 0 || limit <= 0) {
      throw new Error('Page must be non-negative and limit must be positive');
    }

    const params = { symbol, page, limit };
    
    const url = buildUrl(`${BASE_URL}/insider-trading`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching insider trading for ${symbol}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene las transacciones de insider trading por CIK de la empresa
 * @param companyCik - CIK de la empresa
 * @param page - Página de resultados (opcional, por defecto 0)
 * @param limit - Límite de resultados por página (opcional, por defecto 100)
 * @returns Promise con los datos de insider trading de la empresa
 */
export async function getInsiderTradingByCik(
  companyCik: string, 
  page: number = 0, 
  limit: number = 100
): Promise<InsiderTradingResponse> {
  try {
    if (!companyCik || typeof companyCik !== 'string') {
      throw new Error('Company CIK must be a non-empty string');
    }
    if (page < 0 || limit <= 0) {
      throw new Error('Page must be non-negative and limit must be positive');
    }

    const params = { companyCik, page, limit };
    
    const url = buildUrl(`${BASE_URL}/insider-trading`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching insider trading for CIK ${companyCik}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene las transacciones de insider trading por nombre del insider
 * @param reportingName - Nombre del insider
 * @param page - Página de resultados (opcional, por defecto 0)
 * @param limit - Límite de resultados por página (opcional, por defecto 100)
 * @returns Promise con los datos de insider trading del insider
 */
export async function getInsiderTradingByName(
  reportingName: string, 
  page: number = 0, 
  limit: number = 100
): Promise<InsiderTradingResponse> {
  try {
    if (!reportingName || typeof reportingName !== 'string') {
      throw new Error('Reporting name must be a non-empty string');
    }
    if (page < 0 || limit <= 0) {
      throw new Error('Page must be non-negative and limit must be positive');
    }

    const params = { reportingName, page, limit };
    
    const url = buildUrl(`${BASE_URL}/insider-trading`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching insider trading for ${reportingName}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Formatea los datos de insider trading para mostrar
 * @param insiderData - Datos de insider trading
 * @returns Datos formateados para display
 */
export function formatInsiderTradingForDisplay(insiderData: InsiderTradingData[]): FormattedInsiderTrade[] {
  if (!insiderData || insiderData.length === 0) {
    return [];
  }
  
  return insiderData.map(trade => ({
    ...trade,
    formattedFilingDate: new Date(trade.filingDate).toLocaleDateString('es-ES'),
    formattedTransactionDate: new Date(trade.transactionDate).toLocaleDateString('es-ES'),
    transactionValue: trade.securitiesTransacted && trade.price 
      ? formatCurrency(trade.securitiesTransacted * trade.price)
      : 'N/A',
    transactionTypeDescription: getTransactionTypeDescription(trade.transactionType),
    ownerTypeDescription: getOwnerTypeDescription(trade.typeOfOwner),
    isAcquisition: trade.acquisitionOrDisposition === 'A',
    isDisposition: trade.acquisitionOrDisposition === 'D',
    formattedPrice: trade.price ? formatCurrency(trade.price) : 'N/A',
    formattedSecuritiesTransacted: trade.securitiesTransacted 
      ? trade.securitiesTransacted.toLocaleString('es-ES')
      : 'N/A',
    formattedSecuritiesOwned: trade.securitiesOwned 
      ? trade.securitiesOwned.toLocaleString('es-ES')
      : 'N/A'
  }));
}

/**
 * Obtiene la descripción del tipo de transacción
 * @param transactionType - Tipo de transacción
 * @returns Descripción del tipo de transacción
 */
function getTransactionTypeDescription(transactionType: string): string {
  const types: Record<string, string> = {
    'S-Sale': 'Venta',
    'P-Purchase': 'Compra',
    'A-Grant': 'Concesión',
    'M-Exempt': 'Ejercicio de Opción',
    'F-Tax': 'Retención por Impuestos',
    'G-Gift': 'Regalo',
    'D-Return': 'Devolución',
    'J-Other': 'Otro',
    'I-Discretionary': 'Discrecional',
    'W-Will': 'Testamento',
    'X-Exercise': 'Ejercicio',
    'C-Conversion': 'Conversión'
  };
  
  return types[transactionType] || transactionType;
}

/**
 * Obtiene la descripción del tipo de propietario
 * @param typeOfOwner - Tipo de propietario
 * @returns Descripción del tipo de propietario
 */
function getOwnerTypeDescription(typeOfOwner: string): string {
  if (!typeOfOwner) return 'N/A';
  
  if (typeOfOwner.includes('director')) return 'Director';
  if (typeOfOwner.includes('officer')) return 'Ejecutivo';
  if (typeOfOwner.includes('10%')) return 'Accionista >10%';
  if (typeOfOwner.includes('beneficial')) return 'Beneficiario';
  
  return typeOfOwner;
}

/**
 * Formatea valores monetarios
 * @param amount - Cantidad a formatear
 * @returns Cantidad formateada
 */
function formatCurrency(amount: number): string {
  if (!amount || isNaN(amount)) return 'N/A';
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Analiza las tendencias de insider trading para un símbolo
 * @param insiderData - Datos de insider trading
 * @returns Análisis de tendencias
 */
export function analyzeInsiderTradingTrends(insiderData: InsiderTradingData[]): InsiderTradingTrends {
  if (!insiderData || insiderData.length === 0) {
    return {
      totalTransactions: 0,
      buyTransactions: 0,
      sellTransactions: 0,
      netSentiment: 'Neutral',
      totalValue: formatCurrency(0),
      netValue: formatCurrency(0),
      averageTransactionSize: formatCurrency(0),
      mostActiveInsiders: [],
      recentActivity: 'Baja',
      buyToSellRatio: 'N/A'
    };
  }
  
  const buys = insiderData.filter(trade => trade.acquisitionOrDisposition === 'A');
  const sells = insiderData.filter(trade => trade.acquisitionOrDisposition === 'D');
  
  const totalBuyValue = buys.reduce((sum, trade) => {
    const value = trade.securitiesTransacted && trade.price 
      ? trade.securitiesTransacted * trade.price 
      : 0;
    return sum + value;
  }, 0);
  
  const totalSellValue = sells.reduce((sum, trade) => {
    const value = trade.securitiesTransacted && trade.price 
      ? trade.securitiesTransacted * trade.price 
      : 0;
    return sum + value;
  }, 0);
  
  const netValue = totalBuyValue - totalSellValue;
  const totalValue = totalBuyValue + totalSellValue;
  
  // Determinar sentimiento
  let netSentiment = 'Neutral';
  if (netValue > 0) {
    netSentiment = netValue > totalValue * 0.2 ? 'Muy Positivo' : 'Positivo';
  } else if (netValue < 0) {
    netSentiment = Math.abs(netValue) > totalValue * 0.2 ? 'Muy Negativo' : 'Negativo';
  }
  
  // Insiders más activos
  const insiderActivity: Record<string, InsiderActivity> = {};
  insiderData.forEach(trade => {
    if (!insiderActivity[trade.reportingName]) {
      insiderActivity[trade.reportingName] = {
        name: trade.reportingName,
        transactions: 0,
        totalValue: 0,
        typeOfOwner: trade.typeOfOwner
      };
    }
    
    insiderActivity[trade.reportingName].transactions++;
    const value = trade.securitiesTransacted && trade.price 
      ? trade.securitiesTransacted * trade.price 
      : 0;
    insiderActivity[trade.reportingName].totalValue += value;
  });
  
  const mostActiveInsiders = Object.values(insiderActivity)
    .sort((a, b) => b.transactions - a.transactions)
    .slice(0, 5);
  
  // Actividad reciente (últimos 30 días)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentTransactions = insiderData.filter(trade => 
    new Date(trade.transactionDate) >= thirtyDaysAgo
  );
  
  const recentActivity = recentTransactions.length > 10 ? 'Alta' : 
                        recentTransactions.length > 5 ? 'Media' : 'Baja';
  
  return {
    totalTransactions: insiderData.length,
    buyTransactions: buys.length,
    sellTransactions: sells.length,
    netSentiment,
    totalValue: formatCurrency(totalValue),
    netValue: formatCurrency(netValue),
    averageTransactionSize: formatCurrency(totalValue / insiderData.length),
    mostActiveInsiders,
    recentActivity,
    buyToSellRatio: sells.length > 0 ? (buys.length / sells.length).toFixed(2) : 'N/A'
  };
}

/**
 * Obtiene un resumen de insider trading para un símbolo
 * @param symbol - Símbolo de la acción
 * @param limit - Límite de transacciones a analizar
 * @returns Promise con el resumen de insider trading
 */
export async function getInsiderTradingSummary(
  symbol: string, 
  limit: number = 100
): Promise<InsiderTradingSummaryResponse> {
  try {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Symbol must be a non-empty string');
    }
    if (limit <= 0) {
      throw new Error('Limit must be positive');
    }

    const result = await getInsiderTradingBySymbol(symbol, 0, limit);
    
    if (result.error) {
      return {
        error: result.error,
        summary: null
      };
    }
    
    const formattedData = formatInsiderTradingForDisplay(result.data);
    const trends = analyzeInsiderTradingTrends(result.data);
    
    return {
      error: null,
      summary: {
        symbol,
        lastUpdated: result.data[0]?.filingDate || '',
        transactions: formattedData.slice(0, 10), // Últimas 10 transacciones
        trends,
        totalTransactions: result.data.length
      }
    };
  } catch (error) {
    console.error(`Error generating insider trading summary for ${symbol}:`, error);
    return {
      error: error instanceof Error ? error.message : 'Error desconocido',
      summary: null
    };
  }
}

/**
 * Filtra transacciones por tipo de insider
 * @param insiderData - Datos de insider trading
 * @param ownerType - Tipo de propietario ('director', 'officer', '10%')
 * @returns Transacciones filtradas
 */
export function filterByOwnerType(insiderData: InsiderTradingData[], ownerType: string): InsiderTradingData[] {
  if (!insiderData || insiderData.length === 0) {
    return [];
  }
  
  if (!ownerType || typeof ownerType !== 'string') {
    return insiderData;
  }
  
  return insiderData.filter(trade => {
    if (!trade.typeOfOwner) return false;
    
    const lowerOwnerType = trade.typeOfOwner.toLowerCase();
    const lowerFilter = ownerType.toLowerCase();
    
    return lowerOwnerType.includes(lowerFilter);
  });
}

/**
 * Filtra transacciones por rango de fechas
 * @param insiderData - Datos de insider trading
 * @param startDate - Fecha de inicio (YYYY-MM-DD)
 * @param endDate - Fecha de fin (YYYY-MM-DD)
 * @returns Transacciones filtradas
 */
export function filterByDateRange(
  insiderData: InsiderTradingData[], 
  startDate: string, 
  endDate: string
): InsiderTradingData[] {
  if (!insiderData || insiderData.length === 0) {
    return [];
  }
  
  if (!startDate || !endDate) {
    return insiderData;
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  
  return insiderData.filter(trade => {
    const transactionDate = new Date(trade.transactionDate);
    return transactionDate >= start && transactionDate <= end;
  });
}

/**
 * Filtra transacciones por valor mínimo
 * @param insiderData - Datos de insider trading
 * @param minValue - Valor mínimo de la transacción
 * @returns Transacciones filtradas
 */
export function filterByMinValue(insiderData: InsiderTradingData[], minValue: number): InsiderTradingData[] {
  if (!insiderData || insiderData.length === 0) {
    return [];
  }
  
  if (minValue < 0) {
    throw new Error('Minimum value must be non-negative');
  }
  
  return insiderData.filter(trade => {
    const value = trade.securitiesTransacted && trade.price 
      ? trade.securitiesTransacted * trade.price 
      : 0;
    return value >= minValue;
  });
}