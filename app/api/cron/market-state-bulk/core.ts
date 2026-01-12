import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * CORE LOGIC: Market State Bulk
 * 
 * Responsabilidad ÚNICA:
 * Consolidar 1 fila por ticker con el estado de mercado más reciente conocido.
 */
export async function runMarketStateBulk(targetTicker?: string, limit?: number) {
  const BATCH_SIZE = 1000;
  console.log('🚀 Starting Market State Bulk Update...');

  try {
    const supabase = supabaseAdmin;

    // 1. Fetch ALL active tickers from fintra_universe
    let allTickers: string[] = [];

    if (targetTicker) {
        console.log(`[MarketStateBulk] Running for single ticker: ${targetTicker}`);
        allTickers = [targetTicker];
    } else {
        let page = 0;
        console.log('📥 Fetching active tickers...');
        while(true) {
            const { data, error } = await supabase
                .from('fintra_universe')
                .select('ticker')
                .eq('is_active', true)
                .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
                
            if (error) throw new Error(`Error fetching tickers: ${error.message}`);
            if (!data || data.length === 0) break;
            
            allTickers.push(...data.map(d => d.ticker));
            if (data.length < BATCH_SIZE) break;
            page++;
        }
    }
    
    // LIMIT (Benchmark Mode)
    if (limit && limit > 0 && !targetTicker) {
        console.log(`🧪 BENCHMARK MODE: Limiting market state cache to first ${limit} tickers`);
        allTickers = allTickers.slice(0, limit);
    }

    console.log(`📋 Found ${allTickers.length} active tickers.`);

    // 2. Process in chunks
    let processed = 0;
    let upserted = 0;

    // Helper to process a chunk
    const processChunk = async (tickers: string[]) => {
        // A. Fetch Snapshots (Latest per ticker)
        const { data: snapshots, error: snapError } = await supabase
            .from('fintra_snapshots')
            .select('ticker, profile_structural, snapshot_date')
            .in('ticker', tickers)
            .order('snapshot_date', { ascending: false }); 
        
        if (snapError) console.error('Error fetching snapshots:', snapError);

        // B. Fetch Performance (Latest YTD)
        const { data: performance, error: perfError } = await supabase
            .from('datos_performance')
            .select('ticker, return_percent, performance_date')
            .eq('window_code', 'YTD')
            .in('ticker', tickers)
            .lte('performance_date', new Date().toISOString()) // No future data
            .order('performance_date', { ascending: false });

        if (perfError) console.error('Error fetching performance:', perfError);

        // C. Map for O(1) access
        const snapMap = new Map<string, any>();
        if (snapshots) {
            for (const s of snapshots) {
                // If we already have a snapshot for this ticker, skip (since we ordered by date desc, first is latest)
                if (snapMap.has(s.ticker)) continue;

                // Validate price presence
                const metrics = s.profile_structural?.metrics;
                const price = metrics?.price;
                
                // Check if price is valid (not null, not undefined, finite)
                if (price !== null && price !== undefined && !isNaN(Number(price))) {
                    snapMap.set(s.ticker, s);
                }
            }
        }

        const perfMap = new Map<string, any>();
        if (performance) {
            for (const p of performance) {
                if (perfMap.has(p.ticker)) continue; // First is latest
                perfMap.set(p.ticker, p);
            }
        }

        // D. Build Rows
        const rowsToUpsert: any[] = [];
        const now = new Date().toISOString();

        for (const ticker of tickers) {
            const snap = snapMap.get(ticker);
            const perf = perfMap.get(ticker);

            // Extract metrics
            let price = null;
            let change = null;
            let change_percentage = null;
            let market_cap = null;
            let last_price_date = null;

            if (snap) {
                const metrics = snap.profile_structural.metrics;
                price = metrics.price;
                change = metrics.changes;
                
                // MANDATORY: Calculate change_percentage vs previous close
                // Formula: (price - prev_close) / prev_close * 100
                // Derived: change / (price - change) * 100
                if (price != null && change != null) {
                    const p = Number(price);
                    const c = Number(change);
                    const prevClose = p - c;
                    
                    if (prevClose !== 0 && !isNaN(prevClose)) {
                         change_percentage = (c / prevClose) * 100;
                    }
                }
                
                market_cap = metrics.mktCap || metrics.marketCap;
                last_price_date = snap.snapshot_date; // Approximation
            }

            let ytd_return = null;
            if (perf) {
                ytd_return = perf.return_percent;
            }

            rowsToUpsert.push({
                ticker,
                price: price ? Number(price) : null,
                change: change ? Number(change) : null,
                change_percentage: change_percentage ? Number(change_percentage) : null,
                market_cap: market_cap ? Number(market_cap) : null,
                ytd_return: ytd_return ? Number(ytd_return) : null,
                last_price_date,
                source: 'snapshot',
                updated_at: now
            });
        }

        // E. Bulk Upsert
        if (rowsToUpsert.length > 0) {
            const { error } = await supabase
                .from('fintra_market_state')
                .upsert(rowsToUpsert, { onConflict: 'ticker' });
            
            if (error) {
                console.error(`❌ Upsert error for chunk starting ${tickers[0]}:`, error);
            } else {
                upserted += rowsToUpsert.length;
            }
        }
    };

    // Process all tickers in chunks
    for (let i = 0; i < allTickers.length; i += 100) {
        const chunk = allTickers.slice(i, i + 100);
        await processChunk(chunk);
        processed += chunk.length;
    }

    console.log(`✅ Market State Update Complete. Processed: ${processed}, Upserted: ${upserted}`);
    return { success: true, processed, upserted };

  } catch (error) {
    console.error('❌ Critical Error in Market State Bulk:', error);
    throw error;
  }
}
