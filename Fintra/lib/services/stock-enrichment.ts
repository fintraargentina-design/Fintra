
import { fmp } from '@/lib/fmp/client';
import { supabase } from '@/lib/supabase';
import { FintraSnapshotDB, EnrichedStockData } from '@/lib/engine/types';

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
    const [quotes, profiles, snapshotsData, ecosystemReportsData] = await Promise.all([
      fmp.quote(batchString).catch(() => []),
      fmp.profile(batchString).catch(() => []),
      
      // Supabase: Intelligence
      supabase
        .from('fintra_snapshots')
        .select('*')
        .in('ticker', uniqueTickers)
        .order('calculated_at', { ascending: false }),

      // Supabase: Ecosystem Reports (New Source)
      supabase
        .from('fintra_ecosystem_reports')
        .select('ticker, ecosystem_score, date')
        .in('ticker', uniqueTickers)
        .order('date', { ascending: false })
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
             // ecosystem_score: row.ecosystem_score, // REMOVED: Now fetched from fintra_ecosystem_reports
             verdict_text: row.verdict_text ?? "N/A",
             valuation_status: row.valuation_status ?? "Fair",
          });
        }
      });
    }

    // Map Ecosystem Reports (Source: fintra_ecosystem_reports)
    const ecosystemMap = new Map<string, number>();
    if (ecosystemReportsData.data) {
      ecosystemReportsData.data.forEach((row: any) => {
        if (!ecosystemMap.has(row.ticker)) {
          ecosystemMap.set(row.ticker, row.ecosystem_score);
        }
      });
    }

    // Map quotes
    const quoteMap = new Map<string, any>();
    if (Array.isArray(quotes)) {
      quotes.forEach((q: any) => quoteMap.set(q.symbol, q));
    }

    // Map profiles
    const profileMap = new Map<string, any>();
    if (Array.isArray(profiles)) {
      profiles.forEach((p: any) => profileMap.set(p.symbol, p));
    }

    // 2. Fetch detailed data
    // 2a. Batch fetch Price Change (optimization to reduce request count)
    const priceChangeMap = new Map<string, any>();
    try {
        if (uniqueTickers.length > 0) {
            const batchSymbol = uniqueTickers.join(',');
            const priceChanges = await fmp.fetch<any[]>(`/stock-price-change/${batchSymbol}`).catch((err) => {
                 console.warn("Failed to fetch price changes:", err);
                 return [];
            });
            if (Array.isArray(priceChanges)) {
                priceChanges.forEach((pc: any) => priceChangeMap.set(pc.symbol, pc));
            }
        }
    } catch (e) {
        // Continue without price changes
    }

    return uniqueTickers.map(ticker => {
      const quote = quoteMap.get(ticker) || {};
      const profile = profileMap.get(ticker) || {};
      const snap = snapshotMap.get(ticker);
      
      const currentPrice = quote.price || profile.price || 0;
      
      // Get YTD from price change map or quote
      const details = priceChangeMap.get(ticker) || {};
      
      // Calculate upside
      let targetPrice = 0;
      let upside = 0;
      
      // Simple heuristic for target price (mock logic or from snapshot if available)
      // For now, we rely on existing logic or placeholder
      if (snap?.valuation_score) {
          // Mock logic: higher score = higher upside
          const score = snap.valuation_score;
          const factor = 1 + ((score - 50) / 100); 
          targetPrice = currentPrice * factor;
          upside = ((targetPrice - currentPrice) / currentPrice) * 100;
      }

      // Calculate Div Yield
      const lastDiv = profile.lastDiv || 0;
      let divYield = 0;
      if (currentPrice > 0) {
          divYield = (lastDiv / currentPrice) * 100;
      }
      
      return {
        ticker,
        name: quote.name || ticker,
        price: currentPrice,
        marketCap: quote.marketCap || 0,
        ytd: details.ytd_actual || 0,
        divYield, 
        estimation: upside,
        targetPrice: targetPrice,
        fgos: snap?.fgos_score ?? 0, 
        valuation: snap?.valuation_status ?? "N/A",
        ecosystem: ecosystemMap.get(ticker) ?? 50 // Default to 50 if no report found
      };
    });

  } catch (error) {
    console.error("Error enriching stocks:", error);
    return [];
  }
}
