// Configuración de Alpha Vantage API
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

/**
 * Obtiene datos básicos de una acción desde Alpha Vantage
 * @param {string} symbol - Símbolo de la acción (ej: 'AAPL')
 * @returns {Promise<Object>} Datos de la acción
 */
export async function getStockQuote(symbol) {
  try {
    const response = await fetch(
      `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return data['Global Quote'];
  } catch (error) {
    console.error('Error fetching stock quote from Alpha Vantage:', error);
    throw error;
  }
}

/**
 * Obtiene datos de series temporales diarias
 * @param {string} symbol - Símbolo de la acción
 * @returns {Promise<Object>} Datos de series temporales
 */
export async function getDailyTimeSeries(symbol) {
  try {
    const response = await fetch(
      `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching daily time series from Alpha Vantage:', error);
    throw error;
  }
}

/**
 * Obtiene información general de la empresa
 * @param {string} symbol - Símbolo de la acción
 * @returns {Promise<Object>} Información de la empresa
 */
export async function getCompanyOverview(symbol) {
  try {
    const response = await fetch(
      `${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching company overview from Alpha Vantage:', error);
    throw error;
  }
}

/**
 * Busca símbolos de acciones
 * @param {string} keywords - Palabras clave para buscar
 * @returns {Promise<Object>} Resultados de búsqueda
 */
export async function searchSymbols(keywords) {
  try {
    const response = await fetch(
      `${BASE_URL}?function=SYMBOL_SEARCH&keywords=${keywords}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    return data['bestMatches'] || [];
  } catch (error) {
    console.error('Error searching symbols from Alpha Vantage:', error);
    throw error;
  }
}