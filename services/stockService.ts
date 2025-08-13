import { 
  getStockQuote, 
  getDailyTimeSeries, 
  getCompanyOverview, 
  searchSymbols 
} from '../api/alphavantage';

/**
 * Servicio principal que orquesta múltiples APIs para obtener datos de acciones
 */
class StockService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Obtiene datos completos de una acción combinando múltiples fuentes
   * @param {string} symbol - Símbolo de la acción
   * @returns {Promise<Object>} Datos completos de la acción
   */
  async getCompleteStockData(symbol) {
    const cacheKey = `complete_${symbol}`;
    
    // Verificar cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // Obtener datos de múltiples fuentes en paralelo
      const [quote, overview, timeSeries] = await Promise.allSettled([
        getStockQuote(symbol),
        getCompanyOverview(symbol),
        getDailyTimeSeries(symbol)
      ]);

      // Procesar y combinar los datos
      const combinedData = {
        symbol: symbol.toUpperCase(),
        timestamp: new Date().toISOString(),
        quote: quote.status === 'fulfilled' ? quote.value : null,
        overview: overview.status === 'fulfilled' ? overview.value : null,
        timeSeries: timeSeries.status === 'fulfilled' ? timeSeries.value : null,
        // Datos procesados
        processedData: this.processStockData({
          quote: quote.status === 'fulfilled' ? quote.value : null,
          overview: overview.status === 'fulfilled' ? overview.value : null
        })
      };

      // Guardar en cache
      this.cache.set(cacheKey, {
        data: combinedData,
        timestamp: Date.now()
      });

      return combinedData;
    } catch (error) {
      console.error('Error getting complete stock data:', error);
      throw error;
    }
  }

  /**
   * Procesa y normaliza los datos de diferentes APIs
   * @param {Object} rawData - Datos sin procesar
   * @returns {Object} Datos procesados y normalizados
   */
  processStockData(rawData) {
    const { quote, overview } = rawData;
    
    return {
      // Datos básicos
      name: overview?.Name || 'N/A',
      price: quote ? parseFloat(quote['05. price']) : 0,
      change: quote ? parseFloat(quote['09. change']) : 0,
      changePercent: quote ? quote['10. change percent']?.replace('%', '') : '0',
      volume: quote ? parseInt(quote['06. volume']) : 0,
      
      // Datos del overview
      marketCap: overview?.MarketCapitalization || 'N/A',
      peRatio: overview?.PERatio || 'N/A',
      industry: overview?.Industry || 'N/A',
      sector: overview?.Sector || 'N/A',
      country: overview?.Country || 'N/A',
      
      // Datos adicionales
      high: quote ? parseFloat(quote['03. high']) : 0,
      low: quote ? parseFloat(quote['04. low']) : 0,
      open: quote ? parseFloat(quote['02. open']) : 0,
      previousClose: quote ? parseFloat(quote['08. previous close']) : 0
    };
  }

  /**
   * Busca acciones por palabras clave
   * @param {string} query - Consulta de búsqueda
   * @returns {Promise<Array>} Resultados de búsqueda
   */
  async searchStocks(query) {
    try {
      const results = await searchSymbols(query);
      
      return results.map(result => ({
        symbol: result['1. symbol'],
        name: result['2. name'],
        type: result['3. type'],
        region: result['4. region'],
        marketOpen: result['5. marketOpen'],
        marketClose: result['6. marketClose'],
        timezone: result['7. timezone'],
        currency: result['8. currency'],
        matchScore: result['9. matchScore']
      }));
    } catch (error) {
      console.error('Error searching stocks:', error);
      throw error;
    }
  }

  /**
   * Obtiene datos históricos de precios
   * @param {string} symbol - Símbolo de la acción
   * @param {number} days - Número de días hacia atrás
   * @returns {Promise<Array>} Datos históricos
   */
  async getHistoricalData(symbol, days = 30) {
    try {
      const timeSeries = await getDailyTimeSeries(symbol);
      const timeSeriesData = timeSeries['Time Series (Daily)'];
      
      if (!timeSeriesData) {
        return [];
      }

      const dates = Object.keys(timeSeriesData)
        .sort((a, b) => new Date(b) - new Date(a))
        .slice(0, days);

      return dates.map(date => ({
        date,
        open: parseFloat(timeSeriesData[date]['1. open']),
        high: parseFloat(timeSeriesData[date]['2. high']),
        low: parseFloat(timeSeriesData[date]['3. low']),
        close: parseFloat(timeSeriesData[date]['4. close']),
        volume: parseInt(timeSeriesData[date]['5. volume'])
      }));
    } catch (error) {
      console.error('Error getting historical data:', error);
      throw error;
    }
  }

  /**
   * Limpia el cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Exportar instancia singleton
export default new StockService();