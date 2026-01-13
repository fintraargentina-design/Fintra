
import { fmp } from '@/lib/fmp/client';
import { supabase } from '@/lib/supabase';
import { FintraSnapshotDB } from '@/lib/engine/types';

export interface EnrichedStockData {
  ticker: string;
  name?: string;
  // FMP Data
  price: number | null;
  marketCap: number | null;
  ytd: number | null;
  divYield: number | null;
  estimation: number | null; // Upside %
  targetPrice: number | null;
  // Intelligence Data
  fgos: number;
  confidenceLabel?: string;
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
                console.warn("Batch price change fetch failed:", err);
                return [];
            });
            if (Array.isArray(priceChanges)) {
                priceChanges.forEach((pc: any) => {
                    if (pc.symbol) priceChangeMap.set(pc.symbol, pc);
                });
            }
        }
    } catch (e) {
        console.error("Batch price change error:", e);
    }

    // 2b. Fetch Consensus (individual) and merge
    const detailedDataPromises = uniqueTickers.map(async (ticker) => {
      try {
        const consensus = await fmp.priceTargetConsensus(ticker).catch(() => []);
        const pc = priceChangeMap.get(ticker);

        return {
          ticker,
          ytd_actual: pc?.['ytd'] || 0,
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
      const profile = profileMap.get(ticker) || {};
      const snap = snapshotMap.get(ticker);
      const details = detailsMap.get(ticker) || {};
      
      // Calculate Estimation (Upside)
      const currentPrice = quote.price || 0;
      const targetPrice = details.target || 0;
      let upside = 0;
      if (currentPrice > 0 && targetPrice > 0) {
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
