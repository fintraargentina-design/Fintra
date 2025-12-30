
import { fmp } from "@/lib/fmp/client";
import { OHLC } from "@/lib/fmp/types";

/**
 * Determines the benchmark ticker based on the exchange name.
 * Follows strict mapping rules for FMP integration.
 */
export function getBenchmarkForExchange(exchange: string): string {
  if (!exchange) return '^GSPC';
  
  const ex = exchange.toUpperCase();

  // US Markets -> S&P 500
  if (ex.includes('NASDAQ') || ex.includes('NYSE') || ex.includes('AMEX') || ex === 'US') {
    return '^GSPC';
  }

  // Crypto
  if (ex.includes('CRYPTO') || ex.includes('CCY')) {
    return 'BTCUSD';
  }

  // Forex
  if (ex.includes('FOREX') || ex.includes('FX')) {
    return 'EURUSD'; // or ^EURUSD depending on FMP symbol for pair
  }

  // European Markets
  if (ex.includes('LSE') || ex.includes('LONDON')) {
    return '^FTSE';
  }
  if (ex.includes('XETRA') || ex.includes('GERMANY') || ex.includes('FRANKFURT')) {
    return '^GDAXI';
  }
  if (ex.includes('EURONEXT') || ex.includes('PARIS')) {
    return '^FCHI';
  }

  // Asian Markets
  if (ex.includes('TOKYO') || ex.includes('JPX') || ex.includes('TSE')) {
    return '^N225';
  }
  if (ex.includes('HONG KONG') || ex.includes('HKSE') || ex.includes('HKEX')) {
    return '^HSI';
  }

  // Fallback
  return '^GSPC';
}

/**
 * Determines the appropriate benchmark ticker for a given stock symbol.
 * Can accept an optional profile object to avoid re-fetching.
 */
export async function getBenchmarkTicker(symbol: string, profile?: any): Promise<string> {
  const cleanSym = symbol?.toUpperCase().trim() || '';
  if (!cleanSym) return '^GSPC';

  // Hardcoded Overrides for Indices themselves (avoid self-comparison or circular logic if desired)
  // If user views ^GSPC, maybe compare to ^IXIC or keep ^GSPC (flat line)?
  // Usually we compare against itself or a broader market.
  if (cleanSym === '^GSPC') return '^IXIC'; // Compare S&P to Nasdaq
  if (cleanSym === '^IXIC') return '^GSPC'; // Compare Nasdaq to S&P

  try {
    let p = profile;
    
    if (!p) {
       // If no profile provided, fetch it
       try {
         const profiles = await fmp.profile(cleanSym);
         p = Array.isArray(profiles) ? profiles[0] : profiles;
       } catch (e) {
         console.warn(`[getBenchmarkTicker] Failed to fetch profile for ${cleanSym}`, e);
       }
    }

    if (!p) return '^GSPC';

    const exchange = p.exchangeShortName || p.exchange || '';
    const sector = p.sector || '';
    
    // Check specific cases that might not be covered by exchange name alone
    if (p.isEtf && sector === 'Cryptocurrency') return 'BTCUSD';
    
    return getBenchmarkForExchange(exchange);

  } catch (error) {
    console.warn(`Error determining benchmark for ${symbol}:`, error);
    return '^GSPC';
  }
}

/**
 * Fetches historical data for the benchmark
 */
export async function fetchBenchmarkData(ticker: string): Promise<OHLC[]> {
    try {
        // Fetch long history to cover most ranges
        const data = await fmp.eod(ticker, { limit: 2500 }); 
        
        let historical = Array.isArray(data) ? data : (data as any).historical || (data as any).candles || [];
        
        // Ensure consistent sorting (if needed by UI, currently UI handles it or expects one way)
        // Usually FMP returns Newest First.
        return historical;
    } catch (error) {
        console.error(`Error fetching benchmark ${ticker}:`, error);
        return [];
    }
}
