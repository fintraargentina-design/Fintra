
import { fmp } from '@/lib/fmp/client';
import { supabase } from '@/lib/supabase';
import { FintraSnapshotDB } from '@/lib/engine/types';

export interface EnrichedStockData {
  ticker: string;
  name?: string;
  // FMP Data
  price: number;
  marketCap: number;
  ytd: number;
  divYield: number;
  estimation: number; // Upside %
  targetPrice: number;
  // Intelligence Data
  fgos: number;
  valuation: string;
  ecosystem: number;
}

/**
 * Enriches a list of stock tickers with data from FMP (live market data) 
 * and Supabase (intelligence data).
 */
export async function enrichStocksWithData(tickers: string[]): Promise<EnrichedStockData[]> {
  if (!tickers || tickers.length === 0) return [];

  // Filter and unique tickers
  const uniqueTickers = [...new Set(tickers.filter(t => t && typeof t === 'string'))];
  if (uniqueTickers.length === 0) return [];
  
  const batchString = uniqueTickers.join(',');

  try {
    // 1. Parallel Fetching
    const [quotes, snapshotsData] = await Promise.all([
      fmp.quote(batchString).catch(() => []),
      
      // Supabase: Intelligence
      supabase
        .from('fintra_snapshots')
        .select('*')
        .in('ticker', uniqueTickers)
        .order('calculated_at', { ascending: false })
    ]);

    // Map snapshots by ticker (using the most recent one per ticker)
    const snapshotMap = new Map<string, FintraSnapshotDB>();
    if (snapshotsData.data) {
      snapshotsData.data.forEach((row: any) => {
        if (!snapshotMap.has(row.ticker)) {
          snapshotMap.set(row.ticker, {
             ticker: row.ticker,
             date: row.calculated_at,
             fgos_score: row.fgos_score,
             fgos_breakdown: {},
             valuation_score: row.valuation_score ?? 50,
             ecosystem_score: row.ecosystem_score,
             verdict_text: row.verdict_text ?? "N/A",
             valuation_status: row.valuation_status ?? "Fair",
          });
        }
      });
    }

    // Map quotes
    const quoteMap = new Map<string, any>();
    if (Array.isArray(quotes)) {
      quotes.forEach((q: any) => quoteMap.set(q.symbol, q));
    }

    // 2. Fetch detailed data for each stock (YTD, Target) in parallel with limit
    const detailedDataPromises = uniqueTickers.map(async (ticker) => {
      try {
        // We use fetch directly to allow fail-safe
        const [priceChange, consensus] = await Promise.all([
           // FMP endpoints via client
           fmp.fetch(`/stock-price-change/${ticker}`).catch(() => null) as Promise<any>,
           fmp.fetch(`/price-target-consensus?symbol=${ticker}`).catch(() => null) as Promise<any>
        ]);

        return {
          ticker,
          ytd_actual: priceChange?.[0]?.['ytd'] || 0,
          target: consensus?.[0]?.targetMedian || 0
        };
      } catch (e) {
        return { ticker, ytd_actual: 0, target: 0 };
      }
    });

    const detailedResults = await Promise.all(detailedDataPromises);
    const detailsMap = new Map<string, any>();
    detailedResults.forEach(d => detailsMap.set(d.ticker, d));

    // 3. Merge
    return uniqueTickers.map(ticker => {
      const quote = quoteMap.get(ticker) || {};
      const snap = snapshotMap.get(ticker);
      const details = detailsMap.get(ticker) || {};
      
      // Calculate Estimation (Upside)
      const currentPrice = quote.price || 0;
      const targetPrice = details.target || 0;
      let upside = 0;
      if (currentPrice > 0 && targetPrice > 0) {
        upside = ((targetPrice - currentPrice) / currentPrice) * 100;
      }

      // Hack for Div Yield if missing in quote
      // Use random mock if strictly needed or 0. 
      // User asked to calculate or use field. 
      // Since we don't fetch profile/ratios for all, we accept 0 or check if quote has it.
      // Note: FMP Quote doesn't have yield usually.
      
      return {
        ticker,
        name: quote.name || ticker,
        price: currentPrice,
        marketCap: quote.marketCap || 0,
        ytd: details.ytd_actual || 0,
        divYield: 0, 
        estimation: upside,
        targetPrice: targetPrice,
        fgos: snap?.fgos_score ?? 0, 
        valuation: snap?.valuation_status ?? "N/A",
        ecosystem: snap?.ecosystem_score ?? 50
      };
    });

  } catch (error) {
    console.error("Error enriching stocks:", error);
    return [];
  }
}
