import { supabaseAdmin } from '@/lib/supabase-admin';
import { calculateRelativeReturn, RelativeReturnTimeline } from "@/lib/engine/relative-return";

/**
 * CORE LOGIC: Market State Bulk
 * 
 * Responsabilidad ÚNICA:
 * Consolidar 1 fila por ticker con el estado de mercado más reciente conocido.
 * Joins backend tables (universe, snapshots, performance, benchmarks) into fintra_market_state.
 */
export async function runMarketStateBulk(targetTicker?: string, limit?: number) {
  const BATCH_SIZE = 500;
  console.log('🚀 Starting Market State Bulk Update...');

  try {
    const supabase = supabaseAdmin;

    // 1. Fetch ALL active tickers from fintra_universe with PROFILE DATA
    // We need profile data: sector, industry, country. 
    // Other fields (website, description, employees, ceo) come from fintra_snapshots.profile_structural
    let allTickers: any[] = [];
    
    // We fetch full objects now, not just strings
    const universeQuery = supabase
        .from('fintra_universe')
        .select('ticker, sector, industry, country, name, is_active');

    if (targetTicker) {
        universeQuery.eq('ticker', targetTicker);
    } else {
        universeQuery.eq('is_active', true);
    }

    // Handle pagination for universe manually if needed, but supabase-js limit is high.
    // We'll use a loop to be safe for large universe.
    let page = 0;
    const UNIVERSE_BATCH = 1000;
    
    while(true) {
        const { data, error } = await universeQuery.range(page * UNIVERSE_BATCH, (page + 1) * UNIVERSE_BATCH - 1);
        if (error) throw new Error(`Error fetching universe: ${error.message}`);
        if (!data || data.length === 0) break;
        allTickers.push(...data);
        
        if (limit && limit > 0 && allTickers.length >= limit) {
            allTickers = allTickers.slice(0, limit);
            break;
        }

        if (data.length < UNIVERSE_BATCH) break;
        if (targetTicker) break; 
        page++;
    }

    console.log(`📋 Found ${allTickers.length} active tickers to process.`);

    // 2. Pre-fetch Sector Benchmarks (Global Context)
    // We need latest benchmarks to compute percentiles
    // Get latest date first
    const { data: latestBench } = await supabase
        .from('sector_benchmarks')
        .select('snapshot_date')
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();
    
    const benchmarkMap = new Map<string, any>(); // sector -> metric -> benchmark_row
    
    if (latestBench) {
        const { data: benchmarks } = await supabase
            .from('sector_benchmarks')
            .select('*')
            .eq('snapshot_date', latestBench.snapshot_date);
            
        if (benchmarks) {
            benchmarks.forEach((b: any) => {
                if (!benchmarkMap.has(b.sector)) {
                    benchmarkMap.set(b.sector, {});
                }
                benchmarkMap.get(b.sector)[b.metric] = b;
            });
        }
    }

    // 3. Process in chunks
    let processed = 0;
    let upserted = 0;

    // Helper to process a chunk
    const processChunk = async (tickersData: any[]) => {
        const tickers = tickersData.map(t => t.ticker);

        // A. Fetch Snapshots (Latest per ticker)
        // Need: price, changes (for change/change_pct), last_price_date, fgos_score, valuation (contains status), verdict_text, ecosystem_score (if in snap)
        const { data: snapshots, error: snapError } = await supabase
            .from('fintra_snapshots')
            .select('ticker, profile_structural, snapshot_date, fgos_score, fgos_confidence_label, fgos_confidence_percent, valuation, investment_verdict')
            .in('ticker', tickers)
            .order('snapshot_date', { ascending: false }); 
        
        if (snapError) console.error('Error fetching snapshots:', snapError);

        // B. Fetch Performance (All Windows)
        // Need: YTD, 1Y, 3Y, 5Y
        const { data: performance, error: perfError } = await supabase
            .from('datos_performance')
            .select('ticker, return_percent, window_code')
            .in('ticker', tickers)
            .in('window_code', ['YTD', '1Y', '3Y', '5Y']);

        if (perfError) console.error('Error fetching performance:', perfError);

        // C. Fetch Ecosystem Reports
        const { data: ecosystem, error: ecoError } = await supabase
            .from('fintra_ecosystem_reports')
            .select('ticker, ecosystem_score')
            .in('ticker', tickers)
            .order('date', { ascending: false });

        if (ecoError) console.error('Error fetching ecosystem:', ecoError);

        // D. Build Maps for O(1) access
        const snapMap = new Map<string, any>();
        if (snapshots) {
            // Dedupe: keep first (latest)
            for (const s of snapshots) {
                if (!snapMap.has(s.ticker)) snapMap.set(s.ticker, s);
            }
        }

        const perfMap = new Map<string, any>(); // ticker -> { YTD: 10, 1Y: 20 ... }
        if (performance) {
            for (const p of performance) {
                if (!perfMap.has(p.ticker)) perfMap.set(p.ticker, {});
                perfMap.get(p.ticker)[p.window_code] = p.return_percent;
            }
        }

        const ecoMap = new Map<string, number>();
        if (ecosystem) {
             for (const e of ecosystem) {
                if (!ecoMap.has(e.ticker)) ecoMap.set(e.ticker, e.ecosystem_score);
             }
        }

        // E. Build Rows
        const rowsToUpsert: any[] = [];
        const now = new Date().toISOString();

        for (const tData of tickersData) {
            const ticker = tData.ticker;
            const snap = snapMap.get(ticker);
            const perf = perfMap.get(ticker) || {};
            const ecosystem_score = ecoMap.get(ticker) || null;

            // Extract profile structural if available
            const identity = snap?.profile_structural?.identity || {};

            // Determine Price & Market Cap
            // Priority: Snapshot > ... (snapshot is the source of truth for price here)
            let price = null;
            let change = null;
            let change_percentage = null;
            let market_cap = null;
            let last_price_date = null;
            
            // From Snapshot
            if (snap) {
                const metrics = snap.profile_structural?.metrics;
                const identity = snap.profile_structural?.identity;

                // Profile Fields from Snapshot
                if (identity) {
                    if (!tData.website) tData.website = identity.website;
                    if (!tData.description) tData.description = identity.description;
                    if (!tData.employees) tData.employees = identity.fullTimeEmployees;
                    if (!tData.ceo) tData.ceo = identity.ceo;
                }

                if (metrics) {
                    price = metrics.price;
                    change = metrics.changes;
                    market_cap = metrics.mktCap || metrics.marketCap;
                    
                    // Calculate % change
                    if (price != null && change != null) {
                        const p = Number(price);
                        const c = Number(change);
                        const prevClose = p - c;
                        if (prevClose !== 0 && !isNaN(prevClose)) {
                            change_percentage = (c / prevClose) * 100;
                        }
                    }
                }
                last_price_date = snap.snapshot_date;
            }

            // --- Analytics ---
            const fgos_score = snap?.fgos_score ?? null;
            const fgos_confidence_label = snap?.fgos_confidence_label ?? null;
            const fgos_confidence_percent = snap?.fgos_confidence_percent ?? null;
            // valuation_status is inside valuation JSONB
            let valuation_status = null;
            if (snap?.valuation && typeof snap.valuation === 'object') {
                const status = snap.valuation.valuation_status || snap.valuation.status;
                if (status) {
                    valuation_status = String(status).toLowerCase();
                }
            }

            // investment_verdict can be text or object. User asks for verdict_text.
            // Assuming investment_verdict is a string or has a summary. 
            // If it's a JSON, we might need to extract. Assuming string for now based on 'verdict_text' name.
            // If snap.investment_verdict is JSON, try to extract 'verdict' or 'summary'.
            let verdict_text = null;
            if (snap?.investment_verdict) {
                if (typeof snap.investment_verdict === 'string') {
                    verdict_text = snap.investment_verdict;
                } else if (typeof snap.investment_verdict === 'object') {
                    verdict_text = snap.investment_verdict.verdict || snap.investment_verdict.summary || JSON.stringify(snap.investment_verdict);
                }
            }

            // --- Sector Percentiles ---
            let sector_percentiles = null;
            if (tData.sector && fgos_score !== null) {
                const sectorBench = benchmarkMap.get(tData.sector);
                if (sectorBench && sectorBench['FGOS']) {
                    // Compute approximate percentile for FGOS
                    const b = sectorBench['FGOS'];
                    // Simple logic: determine bucket
                    let percentile = 0;
                    if (fgos_score >= b.p90) percentile = 95;
                    else if (fgos_score >= b.p75) percentile = 80; // approx between 75 and 90
                    else if (fgos_score >= b.p50) percentile = 60;
                    else if (fgos_score >= b.p25) percentile = 40;
                    else if (fgos_score >= b.p10) percentile = 20;
                    else percentile = 5;

                    sector_percentiles = {
                        fgos: percentile,
                        // Add other metrics if available in snapshot and benchmarks
                    };
                }
            }

            // --- Market Position ---
            // If not in snapshot, we leave it null or try to construct from FGOS
            let market_position = snap?.market_position || null;

            // --- Strategic State ---
            // Derived from Moat (market_position or fgos) + Sentiment
            let strategic_state = null;
            if (snap?.fgos_breakdown) {
                const bd = snap.fgos_breakdown;
                // Moat Score: Strong=3, Defendable=2, Weak=1
                let moatScore = 1;
                const moatBand = bd.competitive_advantage?.band;
                if (moatBand === 'strong') moatScore = 3;
                else if (moatBand === 'defendable') moatScore = 2;
                
                // Also check market_position summary if available
                if (market_position?.summary) {
                    const s = market_position.summary.toLowerCase();
                    if (s === 'leader' || s === 'strong') moatScore = 3;
                    else if (s === 'average' || s === 'defendable') moatScore = 2;
                }

                // Sentiment Score: Optimistic=3, Neutral=2, Pessimistic=1
                let sentimentScore = 2;
                const sentBand = bd.sentiment_details?.band;
                if (sentBand === 'optimistic') sentimentScore = 3;
                else if (sentBand === 'pessimistic') sentimentScore = 1;

                const diff = moatScore - sentimentScore;
                if (diff === 0) strategic_state = 'Alineado';
                else if (diff > 0) strategic_state = 'En tensión'; // High quality, low sentiment
                else strategic_state = 'Desfasado'; // Low quality, high sentiment
            }

            // --- Relative Return ---
            // Needs Performance + Benchmarks
            let relative_return = null;
            if (tData.sector) {
                const sectorBench = benchmarkMap.get(tData.sector);
                // We need RETURN_1Y, RETURN_3Y, RETURN_5Y from benchmarks
                // Assuming benchmark map has these keys.
                
                const timeline: RelativeReturnTimeline = {
                    '1Y': {
                        asset_return: perf['1Y'] ?? null,
                        benchmark_return: sectorBench?.['RETURN_1Y']?.p50 ?? null // Use p50 (median) as benchmark return
                    },
                    '3Y': {
                        asset_return: perf['3Y'] ?? null,
                        benchmark_return: sectorBench?.['RETURN_3Y']?.p50 ?? null
                    },
                    '5Y': {
                        asset_return: perf['5Y'] ?? null,
                        benchmark_return: sectorBench?.['RETURN_5Y']?.p50 ?? null
                    }
                };

                const rrResult = calculateRelativeReturn(timeline);
                if (rrResult && rrResult.band) {
                    relative_return = {
                        score: rrResult.score,
                        band: rrResult.band,
                        confidence: rrResult.confidence
                    };
                }
            }

            rowsToUpsert.push({
                ticker,
                // Profile
                sector: tData.sector,
                industry: tData.industry,
                // country: tData.country,
                // website: identity.website ?? null,
                // company_name: tData.name,
                // description: identity.description ?? null,
                // employees: identity.fullTimeEmployees ?? null,
                // ceo: identity.ceo ?? null,

                // Market
                price: price ? Number(price) : null,
                change: change ? Number(change) : null,
                change_percentage: change_percentage ? Number(change_percentage) : null,
                last_price_date,
                market_cap: market_cap ? Number(market_cap) : null,

                // Performance
                ytd_return: perf['YTD'] ? Number(perf['YTD']) : null,
                // return_1y: perf['1Y'] ? Number(perf['1Y']) : null,
                // return_3y: perf['3Y'] ? Number(perf['3Y']) : null,
                // return_5y: perf['5Y'] ? Number(perf['5Y']) : null,

                // Analytics
                fgos_score,
                fgos_confidence_label,
                fgos_confidence_percent,
                valuation_status,
                ecosystem_score,
                verdict_text,
                market_position,
                strategic_state,
                relative_return,
                // sector_percentiles, // JSONB

                source: 'market_state_cron',
                updated_at: now
            });
        }

        // F. Bulk Upsert
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
    for (let i = 0; i < allTickers.length; i += BATCH_SIZE) {
        const chunk = allTickers.slice(i, i + BATCH_SIZE);
        await processChunk(chunk);
        processed += chunk.length;
    }

    console.log(`✅ Market State Update Complete. Processed: ${processed}, Upserted: ${upserted}`);
    return { success: true, processed, upserted };

  } catch (error: any) {
    console.error('❌ Critical Error in Market State Bulk:', error);
    throw error;
  }
}
