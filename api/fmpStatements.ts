import { buildUrl } from './fmpConfig';

const BASE_URL = 'https://financialmodelingprep.com/stable';

// Interface definitions
interface FinancialRatio {
  date: string;
  grossProfitMargin: number;
  operatingProfitMargin: number;
  netProfitMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  debtToEquityRatio: number;
  debtToAssetsRatio: number;
  financialLeverageRatio: number;
  assetTurnover: number;
  inventoryTurnover: number;
  receivablesTurnover: number;
  priceToEarningsRatio: number;
  priceToBookRatio: number;
  priceToSalesRatio: number;
  enterpriseValueMultiple: number;
}

interface KeyMetric {
  date: string;
  marketCap: number;
  enterpriseValue: number;
  evToSales: number;
  evToEBITDA: number;
  returnOnAssets: number;
  returnOnEquity: number;
  returnOnInvestedCapital: number;
  workingCapital: number;
  freeCashFlowYield: number;
  capexToOperatingCashFlow: number;
  currentRatio: number;
  incomeQuality: number;
  grahamNumber: number;
}

interface IncomeStatementGrowth {
  date: string;
  growthRevenue: number;
  growthGrossProfit: number;
  growthOperatingIncome: number;
  growthNetIncome: number;
  growthEPS: number;
  growthEBITDA: number;
  growthResearchAndDevelopmentExpenses: number;
  growthOperatingExpenses: number;
}

interface FinancialDataResponse<T> {
  data: T[];
  error: string | null;
}

interface AllFinancialData {
  ratios: FinancialDataResponse<FinancialRatio>;
  keyMetrics: FinancialDataResponse<KeyMetric>;
  incomeGrowth: FinancialDataResponse<IncomeStatementGrowth>;
}

interface FormattedProfitability {
  grossProfitMargin: string;
  operatingProfitMargin: string;
  netProfitMargin: string;
  returnOnAssets: string;
  returnOnEquity: string;
}

interface FormattedLiquidity {
  currentRatio: string;
  quickRatio: string;
  cashRatio: string;
}

interface FormattedLeverage {
  debtToEquityRatio: string;
  debtToAssetsRatio: string;
  financialLeverageRatio: string;
}

interface FormattedEfficiency {
  assetTurnover: string;
  inventoryTurnover: string;
  receivablesTurnover: string;
}

interface FormattedValuation {
  priceToEarningsRatio: string;
  priceToBookRatio: string;
  priceToSalesRatio: string;
  enterpriseValueMultiple: string;
}

interface FormattedFinancialRatios {
  profitability: FormattedProfitability;
  liquidity: FormattedLiquidity;
  leverage: FormattedLeverage;
  efficiency: FormattedEfficiency;
  valuation: FormattedValuation;
}

interface FormattedKeyMetricsValuation {
  marketCap: string;
  enterpriseValue: string;
  evToSales: string;
  evToEBITDA: string;
}

interface FormattedKeyMetricsReturns {
  returnOnAssets: string;
  returnOnEquity: string;
  returnOnInvestedCapital: string;
}

interface FormattedKeyMetricsEfficiency {
  workingCapital: string;
  freeCashFlowYield: string;
  capexToOperatingCashFlow: string;
}

interface FormattedKeyMetricsFinancial {
  currentRatio: string;
  incomeQuality: string;
  grahamNumber: string;
}

interface FormattedKeyMetrics {
  valuation: FormattedKeyMetricsValuation;
  returns: FormattedKeyMetricsReturns;
  efficiency: FormattedKeyMetricsEfficiency;
  financial: FormattedKeyMetricsFinancial;
}

interface FormattedGrowthRevenue {
  revenueGrowth: string;
  grossProfitGrowth: string;
  operatingIncomeGrowth: string;
}

interface FormattedGrowthProfitability {
  netIncomeGrowth: string;
  epsGrowth: string;
  ebitdaGrowth: string;
}

interface FormattedGrowthEfficiency {
  rdExpensesGrowth: string;
  operatingExpensesGrowth: string;
}

interface FormattedGrowthData {
  revenue: FormattedGrowthRevenue;
  profitability: FormattedGrowthProfitability;
  efficiency: FormattedGrowthEfficiency;
}

interface GrowthTrends {
  revenueConsistency: string;
  profitabilityTrend: string;
  averageGrowth: {
    revenue: string;
    netIncome: string;
    eps: string;
  };
}

interface FinancialHealthSummary {
  symbol: string;
  lastUpdated: string;
  profitability: FormattedProfitability;
  liquidity: FormattedLiquidity;
  valuation: FormattedKeyMetricsValuation;
  growth: FormattedGrowthRevenue;
  trends: GrowthTrends;
}

interface FinancialHealthSummaryResponse {
  error: string | null;
  summary: FinancialHealthSummary | null;
}

/**
 * Obtiene los ratios financieros para un símbolo específico
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @param limit - Número de períodos a obtener (opcional)
 * @returns Promise con los datos de ratios financieros
 */
export async function getFinancialRatios(
  symbol: string, 
  limit: number = 5
): Promise<FinancialDataResponse<FinancialRatio>> {
  if (!symbol || typeof symbol !== 'string') {
    return {
      data: [],
      error: 'Symbol must be a non-empty string'
    };
  }

  if (limit <= 0 || !Number.isInteger(limit)) {
    return {
      data: [],
      error: 'Limit must be a positive integer'
    };
  }

  try {
    const params: Record<string, any> = { symbol };
    if (limit) params.limit = limit;
    
    const url = buildUrl(`${BASE_URL}/ratios`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching financial ratios for ${symbol}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene las métricas clave para un símbolo específico
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @param limit - Número de períodos a obtener (opcional)
 * @returns Promise con los datos de métricas clave
 */
export async function getKeyMetrics(
  symbol: string, 
  limit: number = 5
): Promise<FinancialDataResponse<KeyMetric>> {
  if (!symbol || typeof symbol !== 'string') {
    return {
      data: [],
      error: 'Symbol must be a non-empty string'
    };
  }

  if (limit <= 0 || !Number.isInteger(limit)) {
    return {
      data: [],
      error: 'Limit must be a positive integer'
    };
  }

  try {
    const params: Record<string, any> = { symbol };
    if (limit) params.limit = limit;
    
    const url = buildUrl(`${BASE_URL}/key-metrics`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching key metrics for ${symbol}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene el crecimiento del estado de resultados para un símbolo específico
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @param limit - Número de períodos a obtener (opcional)
 * @returns Promise con los datos de crecimiento
 */
export async function getIncomeStatementGrowth(
  symbol: string, 
  limit: number = 5
): Promise<FinancialDataResponse<IncomeStatementGrowth>> {
  if (!symbol || typeof symbol !== 'string') {
    return {
      data: [],
      error: 'Symbol must be a non-empty string'
    };
  }

  if (limit <= 0 || !Number.isInteger(limit)) {
    return {
      data: [],
      error: 'Limit must be a positive integer'
    };
  }

  try {
    const params: Record<string, any> = { symbol };
    if (limit) params.limit = limit;
    
    const url = buildUrl(`${BASE_URL}/income-statement-growth`, params);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error(`Error fetching income statement growth for ${symbol}:`, error);
    return {
      data: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Obtiene todos los datos financieros en paralelo
 * @param symbol - Símbolo de la acción
 * @param limit - Número de períodos a obtener (opcional)
 * @returns Promise con todos los conjuntos de datos
 */
export async function getAllFinancialData(
  symbol: string, 
  limit: number = 5
): Promise<AllFinancialData> {
  if (!symbol || typeof symbol !== 'string') {
    const errorResponse = {
      data: [],
      error: 'Symbol must be a non-empty string'
    };
    return {
      ratios: errorResponse,
      keyMetrics: errorResponse,
      incomeGrowth: errorResponse
    };
  }

  try {
    const [ratiosResult, metricsResult, growthResult] = await Promise.all([
      getFinancialRatios(symbol, limit),
      getKeyMetrics(symbol, limit),
      getIncomeStatementGrowth(symbol, limit)
    ]);
    
    return {
      ratios: ratiosResult,
      keyMetrics: metricsResult,
      incomeGrowth: growthResult
    };
  } catch (error) {
    console.error('Error fetching all financial data:', error);
    return {
      ratios: { data: [], error: 'Error al obtener ratios' },
      keyMetrics: { data: [], error: 'Error al obtener métricas' },
      incomeGrowth: { data: [], error: 'Error al obtener crecimiento' }
    };
  }
}

/**
 * Formatea los ratios financieros para mostrar
 * @param ratiosData - Datos de ratios financieros
 * @returns Datos formateados para display
 */
export function formatFinancialRatiosForDisplay(
  ratiosData: FinancialRatio[]
): FormattedFinancialRatios {
  if (!ratiosData || ratiosData.length === 0) {
    return {
      profitability: {
        grossProfitMargin: 'N/A',
        operatingProfitMargin: 'N/A',
        netProfitMargin: 'N/A',
        returnOnAssets: 'N/A',
        returnOnEquity: 'N/A'
      },
      liquidity: {
        currentRatio: 'N/A',
        quickRatio: 'N/A',
        cashRatio: 'N/A'
      },
      leverage: {
        debtToEquityRatio: 'N/A',
        debtToAssetsRatio: 'N/A',
        financialLeverageRatio: 'N/A'
      },
      efficiency: {
        assetTurnover: 'N/A',
        inventoryTurnover: 'N/A',
        receivablesTurnover: 'N/A'
      },
      valuation: {
        priceToEarningsRatio: 'N/A',
        priceToBookRatio: 'N/A',
        priceToSalesRatio: 'N/A',
        enterpriseValueMultiple: 'N/A'
      }
    };
  }
  
  const latest = ratiosData[0];
  
  return {
    profitability: {
      grossProfitMargin: (latest.grossProfitMargin * 100).toFixed(2) + '%',
      operatingProfitMargin: (latest.operatingProfitMargin * 100).toFixed(2) + '%',
      netProfitMargin: (latest.netProfitMargin * 100).toFixed(2) + '%',
      returnOnAssets: (latest.returnOnAssets * 100).toFixed(2) + '%',
      returnOnEquity: (latest.returnOnEquity * 100).toFixed(2) + '%'
    },
    liquidity: {
      currentRatio: latest.currentRatio?.toFixed(2) ?? 'N/A',
      quickRatio: latest.quickRatio?.toFixed(2) ?? 'N/A',
      cashRatio: latest.cashRatio?.toFixed(2) ?? 'N/A'
    },
    leverage: {
      debtToEquityRatio: latest.debtToEquityRatio?.toFixed(2) ?? 'N/A',
      debtToAssetsRatio: (latest.debtToAssetsRatio * 100).toFixed(2) + '%',
      financialLeverageRatio: latest.financialLeverageRatio?.toFixed(2) ?? 'N/A'
    },
    efficiency: {
      assetTurnover: latest.assetTurnover?.toFixed(2) ?? 'N/A',
      inventoryTurnover: latest.inventoryTurnover?.toFixed(2) ?? 'N/A',
      receivablesTurnover: latest.receivablesTurnover?.toFixed(2) ?? 'N/A'
    },
    valuation: {
      priceToEarningsRatio: latest.priceToEarningsRatio?.toFixed(2) ?? 'N/A',
      priceToBookRatio: latest.priceToBookRatio?.toFixed(2) ?? 'N/A',
      priceToSalesRatio: latest.priceToSalesRatio?.toFixed(2) ?? 'N/A',
      enterpriseValueMultiple: latest.enterpriseValueMultiple?.toFixed(2) ?? 'N/A'
    }
  };
}

/**
 * Formatea las métricas clave para mostrar
 * @param metricsData - Datos de métricas clave
 * @returns Datos formateados para display
 */
export function formatKeyMetricsForDisplay(
  metricsData: KeyMetric[]
): FormattedKeyMetrics {
  if (!metricsData || metricsData.length === 0) {
    return {
      valuation: {
        marketCap: 'N/A',
        enterpriseValue: 'N/A',
        evToSales: 'N/A',
        evToEBITDA: 'N/A'
      },
      returns: {
        returnOnAssets: 'N/A',
        returnOnEquity: 'N/A',
        returnOnInvestedCapital: 'N/A'
      },
      efficiency: {
        workingCapital: 'N/A',
        freeCashFlowYield: 'N/A',
        capexToOperatingCashFlow: 'N/A'
      },
      financial: {
        currentRatio: 'N/A',
        incomeQuality: 'N/A',
        grahamNumber: 'N/A'
      }
    };
  }
  
  const latest = metricsData[0];
  
  return {
    valuation: {
      marketCap: formatLargeNumber(latest.marketCap),
      enterpriseValue: formatLargeNumber(latest.enterpriseValue),
      evToSales: latest.evToSales?.toFixed(2) ?? 'N/A',
      evToEBITDA: latest.evToEBITDA?.toFixed(2) ?? 'N/A'
    },
    returns: {
      returnOnAssets: (latest.returnOnAssets * 100).toFixed(2) + '%',
      returnOnEquity: (latest.returnOnEquity * 100).toFixed(2) + '%',
      returnOnInvestedCapital: (latest.returnOnInvestedCapital * 100).toFixed(2) + '%'
    },
    efficiency: {
      workingCapital: formatLargeNumber(latest.workingCapital),
      freeCashFlowYield: (latest.freeCashFlowYield * 100).toFixed(2) + '%',
      capexToOperatingCashFlow: (latest.capexToOperatingCashFlow * 100).toFixed(2) + '%'
    },
    financial: {
      currentRatio: latest.currentRatio?.toFixed(2) ?? 'N/A',
      incomeQuality: latest.incomeQuality?.toFixed(2) ?? 'N/A',
      grahamNumber: latest.grahamNumber?.toFixed(2) ?? 'N/A'
    }
  };
}

/**
 * Formatea los datos de crecimiento para mostrar
 * @param growthData - Datos de crecimiento
 * @returns Datos formateados para display
 */
export function formatGrowthDataForDisplay(
  growthData: IncomeStatementGrowth[]
): FormattedGrowthData {
  if (!growthData || growthData.length === 0) {
    return {
      revenue: {
        revenueGrowth: 'N/A',
        grossProfitGrowth: 'N/A',
        operatingIncomeGrowth: 'N/A'
      },
      profitability: {
        netIncomeGrowth: 'N/A',
        epsGrowth: 'N/A',
        ebitdaGrowth: 'N/A'
      },
      efficiency: {
        rdExpensesGrowth: 'N/A',
        operatingExpensesGrowth: 'N/A'
      }
    };
  }
  
  const latest = growthData[0];
  
  return {
    revenue: {
      revenueGrowth: (latest.growthRevenue * 100).toFixed(2) + '%',
      grossProfitGrowth: (latest.growthGrossProfit * 100).toFixed(2) + '%',
      operatingIncomeGrowth: (latest.growthOperatingIncome * 100).toFixed(2) + '%'
    },
    profitability: {
      netIncomeGrowth: (latest.growthNetIncome * 100).toFixed(2) + '%',
      epsGrowth: (latest.growthEPS * 100).toFixed(2) + '%',
      ebitdaGrowth: (latest.growthEBITDA * 100).toFixed(2) + '%'
    },
    efficiency: {
      rdExpensesGrowth: (latest.growthResearchAndDevelopmentExpenses * 100).toFixed(2) + '%',
      operatingExpensesGrowth: (latest.growthOperatingExpenses * 100).toFixed(2) + '%'
    }
  };
}

/**
 * Calcula tendencias de crecimiento
 * @param growthData - Datos históricos de crecimiento
 * @returns Análisis de tendencias
 */
export function calculateGrowthTrends(
  growthData: IncomeStatementGrowth[]
): GrowthTrends {
  if (!growthData || growthData.length < 2) {
    return {
      revenueConsistency: 'Insuficientes datos',
      profitabilityTrend: 'Insuficientes datos',
      averageGrowth: {
        revenue: 'N/A',
        netIncome: 'N/A',
        eps: 'N/A'
      }
    };
  }
  
  const revenueGrowths = growthData
    .map(d => d.growthRevenue)
    .filter((g): g is number => g !== null && g !== undefined);
  const netIncomeGrowths = growthData
    .map(d => d.growthNetIncome)
    .filter((g): g is number => g !== null && g !== undefined);
  const epsGrowths = growthData
    .map(d => d.growthEPS)
    .filter((g): g is number => g !== null && g !== undefined);
  
  if (revenueGrowths.length === 0 || netIncomeGrowths.length === 0 || epsGrowths.length === 0) {
    return {
      revenueConsistency: 'Datos insuficientes',
      profitabilityTrend: 'Datos insuficientes',
      averageGrowth: {
        revenue: 'N/A',
        netIncome: 'N/A',
        eps: 'N/A'
      }
    };
  }
  
  const avgRevenueGrowth = revenueGrowths.reduce((a, b) => a + b, 0) / revenueGrowths.length;
  const avgNetIncomeGrowth = netIncomeGrowths.reduce((a, b) => a + b, 0) / netIncomeGrowths.length;
  const avgEpsGrowth = epsGrowths.reduce((a, b) => a + b, 0) / epsGrowths.length;
  
  // Calcular consistencia (menor desviación estándar = más consistente)
  const revenueStdDev = calculateStandardDeviation(revenueGrowths);
  const revenueConsistency = revenueStdDev < 0.1 ? 'Alta' : revenueStdDev < 0.2 ? 'Media' : 'Baja';
  
  // Determinar tendencia de profitabilidad
  const recentNetIncomeGrowth = netIncomeGrowths.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
  const profitabilityTrend = recentNetIncomeGrowth > 0 ? 'Positiva' : 'Negativa';
  
  return {
    revenueConsistency,
    profitabilityTrend,
    averageGrowth: {
      revenue: (avgRevenueGrowth * 100).toFixed(2) + '%',
      netIncome: (avgNetIncomeGrowth * 100).toFixed(2) + '%',
      eps: (avgEpsGrowth * 100).toFixed(2) + '%'
    }
  };
}

/**
 * Calcula la desviación estándar
 * @param values - Array de valores
 * @returns Desviación estándar
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Formatea números grandes
 * @param num - Número a formatear
 * @returns Número formateado
 */
function formatLargeNumber(num: number | undefined): string {
  if (!num || !Number.isFinite(num)) return 'N/A';
  
  if (num >= 1e12) {
    return (num / 1e12).toFixed(2) + 'T';
  } else if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + 'K';
  }
  
  return num.toFixed(2);
}

/**
 * Obtiene un resumen ejecutivo de la salud financiera
 * @param symbol - Símbolo de la acción
 * @returns Promise con el resumen ejecutivo
 */
export async function getFinancialHealthSummary(
  symbol: string
): Promise<FinancialHealthSummaryResponse> {
  if (!symbol || typeof symbol !== 'string') {
    return {
      error: 'Symbol must be a non-empty string',
      summary: null
    };
  }

  try {
    const allData = await getAllFinancialData(symbol, 3);
    
    if (allData.ratios.error || allData.keyMetrics.error || allData.incomeGrowth.error) {
      return {
        error: 'Error al obtener datos financieros',
        summary: null
      };
    }
    
    const ratios = formatFinancialRatiosForDisplay(allData.ratios.data);
    const metrics = formatKeyMetricsForDisplay(allData.keyMetrics.data);
    const growth = formatGrowthDataForDisplay(allData.incomeGrowth.data);
    const trends = calculateGrowthTrends(allData.incomeGrowth.data);
    
    return {
      error: null,
      summary: {
        symbol,
        lastUpdated: allData.ratios.data[0]?.date ?? 'N/A',
        profitability: ratios.profitability,
        liquidity: ratios.liquidity,
        valuation: metrics.valuation,
        growth: growth.revenue,
        trends
      }
    };
  } catch (error) {
    console.error(`Error generating financial health summary for ${symbol}:`, error);
    return {
      error: error instanceof Error ? error.message : 'Error desconocido',
      summary: null
    };
  }
}