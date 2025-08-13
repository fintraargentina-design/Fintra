import { buildUrl } from './fmpConfig';

const BASE_URL = 'https://financialmodelingprep.com/stable';

// Interface definitions
interface Grade {
  symbol: string;
  date: string;
  gradingCompany: string;
  previousGrade: string;
  newGrade: string;
  action: 'upgrade' | 'downgrade' | 'maintain';
}

interface HistoricalGrade {
  symbol: string;
  date: string;
  analystRatingsStrongBuy: number;
  analystRatingsBuy: number;
  analystRatingsHold: number;
  analystRatingsSell: number;
  analystRatingsStrongSell: number;
}

interface GradesConsensus {
  symbol: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  consensus: string;
}

interface GradeNews {
  symbol: string;
  publishedDate: string;
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
}

interface UpgradesDowngradesData {
  symbol: string;
  grades: Grade[] | null;
  historical: HistoricalGrade[] | null;
  consensus: GradesConsensus | null;
  latestNews: GradeNews[];
  allNews: GradeNews[];
}

interface FormattedConsensus {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  consensus: string;
  totalAnalysts: number;
}

interface RecentActivity {
  upgrades: number;
  downgrades: number;
  maintains: number;
  total: number;
}

interface HistoricalTrend {
  bullishChange: number;
  bearishChange: number;
  neutralChange: number;
  trend: 'improving' | 'deteriorating' | 'stable';
}

interface FormattedUpgradesDowngrades {
  symbol: string;
  consensus: FormattedConsensus | null;
  recentActivity: RecentActivity;
  historicalTrend: HistoricalTrend | null;
  latestNews: GradeNews[];
  recentGrades: Grade[];
}

interface AnalystSentiment {
  sentiment: string;
  color: string;
  score: number;
}

interface AnalystFirm {
  firm: string;
  count: number;
}

/**
 * Obtiene los grades/ratings actuales para un símbolo
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @param limit - Límite de resultados (opcional)
 * @returns Array de grades actuales
 */
export async function getGrades(symbol: string, limit: number = 50): Promise<Grade[] | null> {
  if (!symbol || typeof symbol !== 'string') {
    console.error('Symbol is required for grades and must be a string');
    return null;
  }

  if (limit <= 0 || !Number.isInteger(limit)) {
    console.error('Limit must be a positive integer');
    return null;
  }

  const params: Record<string, any> = { symbol };
  if (limit) params.limit = limit;
  
  const url = buildUrl(`${BASE_URL}/grades`, params);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching grades for ${symbol}:`, error);
    return null;
  }
}

/**
 * Obtiene el historial de ratings por mes para un símbolo
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @param limit - Límite de resultados (opcional)
 * @returns Array de ratings históricos
 */
export async function getGradesHistorical(
  symbol: string, 
  limit: number = 24
): Promise<HistoricalGrade[] | null> {
  if (!symbol || typeof symbol !== 'string') {
    console.error('Symbol is required for historical grades and must be a string');
    return null;
  }

  if (limit <= 0 || !Number.isInteger(limit)) {
    console.error('Limit must be a positive integer');
    return null;
  }

  const params: Record<string, any> = { symbol };
  if (limit) params.limit = limit;
  
  const url = buildUrl(`${BASE_URL}/grades-historical`, params);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching historical grades for ${symbol}:`, error);
    return null;
  }
}

/**
 * Obtiene el consenso actual de ratings para un símbolo
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @returns Consenso de ratings
 */
export async function getGradesConsensus(symbol: string): Promise<GradesConsensus | null> {
  if (!symbol || typeof symbol !== 'string') {
    console.error('Symbol is required for grades consensus and must be a string');
    return null;
  }

  const url = buildUrl(`${BASE_URL}/grades-consensus`, { symbol });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error(`Error fetching grades consensus for ${symbol}:`, error);
    return null;
  }
}

/**
 * Obtiene las noticias más recientes de upgrades/downgrades
 * @param page - Página de resultados (default: 0)
 * @param limit - Límite de resultados (default: 10)
 * @returns Array de noticias de grades
 */
export async function getGradesLatestNews(
  page: number = 0, 
  limit: number = 10
): Promise<GradeNews[] | null> {
  if (page < 0 || !Number.isInteger(page)) {
    console.error('Page must be a non-negative integer');
    return null;
  }

  if (limit <= 0 || !Number.isInteger(limit)) {
    console.error('Limit must be a positive integer');
    return null;
  }

  const url = buildUrl(`${BASE_URL}/grades-latest-news`, { page, limit });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching latest grades news:', error);
    return null;
  }
}

/**
 * Obtiene todos los datos de upgrades/downgrades para un símbolo
 * @param symbol - Símbolo de la acción (ej: 'AAPL')
 * @returns Objeto con todos los datos de grades
 */
export async function getUpgradesDowngradesData(symbol: string): Promise<UpgradesDowngradesData> {
  if (!symbol || typeof symbol !== 'string') {
    return {
      symbol: symbol || '',
      grades: null,
      historical: null,
      consensus: null,
      latestNews: [],
      allNews: []
    };
  }

  try {
    const [grades, historical, consensus, latestNews] = await Promise.all([
      getGrades(symbol),
      getGradesHistorical(symbol),
      getGradesConsensus(symbol),
      getGradesLatestNews(0, 20)
    ]);

    // Filtrar noticias para el símbolo específico
    const symbolNews = latestNews ? latestNews.filter(news => news.symbol === symbol) : [];

    return {
      symbol,
      grades,
      historical,
      consensus,
      latestNews: symbolNews,
      allNews: latestNews || []
    };
  } catch (error) {
    console.error(`Error fetching upgrades/downgrades data for ${symbol}:`, error);
    return {
      symbol,
      grades: null,
      historical: null,
      consensus: null,
      latestNews: [],
      allNews: []
    };
  }
}

/**
 * Formatea los datos de upgrades/downgrades para mostrar
 * @param upgradesData - Datos de upgrades/downgrades
 * @returns Datos formateados
 */
export function formatUpgradesDowngradesForDisplay(
  upgradesData: UpgradesDowngradesData
): FormattedUpgradesDowngrades | null {
  if (!upgradesData) return null;

  const { symbol, grades, historical, consensus, latestNews } = upgradesData;

  // Calcular estadísticas de grades recientes
  const recentGrades = grades ? grades.slice(0, 10) : [];
  const upgradeCount = recentGrades.filter(g => g.action === 'upgrade').length;
  const downgradeCount = recentGrades.filter(g => g.action === 'downgrade').length;
  const maintainCount = recentGrades.filter(g => g.action === 'maintain').length;

  // Calcular tendencia histórica
  const historicalTrend = historical && historical.length >= 2 ? 
    calculateHistoricalTrend(historical) : null;

  return {
    symbol,
    consensus: consensus ? {
      strongBuy: consensus.strongBuy || 0,
      buy: consensus.buy || 0,
      hold: consensus.hold || 0,
      sell: consensus.sell || 0,
      strongSell: consensus.strongSell || 0,
      consensus: consensus.consensus || 'N/A',
      totalAnalysts: (consensus.strongBuy || 0) + (consensus.buy || 0) + 
                    (consensus.hold || 0) + (consensus.sell || 0) + (consensus.strongSell || 0)
    } : null,
    recentActivity: {
      upgrades: upgradeCount,
      downgrades: downgradeCount,
      maintains: maintainCount,
      total: recentGrades.length
    },
    historicalTrend,
    latestNews: latestNews ? latestNews.slice(0, 5) : [],
    recentGrades: recentGrades.slice(0, 5)
  };
}

/**
 * Calcula la tendencia histórica de ratings
 * @param historical - Datos históricos
 * @returns Tendencia calculada
 */
function calculateHistoricalTrend(historical: HistoricalGrade[]): HistoricalTrend | null {
  if (!historical || historical.length < 2) return null;

  const latest = historical[0];
  const previous = historical[1];

  const latestBullish = (latest.analystRatingsStrongBuy || 0) + (latest.analystRatingsBuy || 0);
  const latestBearish = (latest.analystRatingsSell || 0) + (latest.analystRatingsStrongSell || 0);
  const latestNeutral = latest.analystRatingsHold || 0;

  const previousBullish = (previous.analystRatingsStrongBuy || 0) + (previous.analystRatingsBuy || 0);
  const previousBearish = (previous.analystRatingsSell || 0) + (previous.analystRatingsStrongSell || 0);
  const previousNeutral = previous.analystRatingsHold || 0;

  return {
    bullishChange: latestBullish - previousBullish,
    bearishChange: latestBearish - previousBearish,
    neutralChange: latestNeutral - previousNeutral,
    trend: latestBullish > previousBullish ? 'improving' : 
           latestBullish < previousBullish ? 'deteriorating' : 'stable'
  };
}

/**
 * Obtiene el sentimiento general basado en el consenso
 * @param consensus - Datos del consenso
 * @returns Sentimiento y color
 */
export function getAnalystSentiment(consensus: GradesConsensus | null): AnalystSentiment {
  if (!consensus) return { sentiment: 'Unknown', color: 'gray', score: 0 };

  const total = consensus.strongBuy + consensus.buy + consensus.hold + consensus.sell + consensus.strongSell;
  if (total === 0) return { sentiment: 'No Coverage', color: 'gray', score: 0 };

  const bullishPercent = ((consensus.strongBuy + consensus.buy) / total) * 100;
  const bearishPercent = ((consensus.sell + consensus.strongSell) / total) * 100;

  if (bullishPercent >= 70) {
    return { sentiment: 'Muy Optimista', color: 'green', score: 5 };
  } else if (bullishPercent >= 50) {
    return { sentiment: 'Optimista', color: 'lightgreen', score: 4 };
  } else if (bearishPercent >= 30) {
    return { sentiment: 'Pesimista', color: 'red', score: 2 };
  } else if (bearishPercent >= 15) {
    return { sentiment: 'Cauteloso', color: 'orange', score: 3 };
  } else {
    return { sentiment: 'Neutral', color: 'yellow', score: 3 };
  }
}

/**
 * Filtra grades por acción específica
 * @param grades - Array de grades
 * @param action - Acción a filtrar ('upgrade', 'downgrade', 'maintain')
 * @returns Grades filtrados
 */
export function filterGradesByAction(
  grades: Grade[] | null, 
  action: 'upgrade' | 'downgrade' | 'maintain'
): Grade[] {
  if (!grades || !Array.isArray(grades)) return [];
  return grades.filter(grade => grade.action === action);
}

/**
 * Obtiene las firmas más activas en upgrades/downgrades
 * @param grades - Array de grades
 * @returns Firmas ordenadas por actividad
 */
export function getMostActiveAnalystFirms(grades: Grade[] | null): AnalystFirm[] {
  if (!grades || !Array.isArray(grades)) return [];

  const firmCounts: Record<string, number> = {};
  grades.forEach(grade => {
    const firm = grade.gradingCompany;
    if (firm) {
      firmCounts[firm] = (firmCounts[firm] || 0) + 1;
    }
  });

  return Object.entries(firmCounts)
    .map(([firm, count]) => ({ firm, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}