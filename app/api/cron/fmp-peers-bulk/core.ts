import Papa from 'papaparse';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';

export async function runPeersBulk(targetTicker?: string, limit: number = Infinity) {
  console.log(`[PeersBulk] Starting run... Target: ${targetTicker || 'ALL'}`);
  const supabase = supabaseAdmin;

  // 1. Fetch peers BULK (CSV)
  const url = `https://financialmodelingprep.com/stable/peers-bulk?apikey=${process.env.FMP_API_KEY}`;
  console.log(`[PeersBulk] Fetching ${url}...`);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error('FMP peers-bulk fetch failed');
  }

  const csv = await res.text();

  // 2. Parse CSV
  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as any[];
  console.log(`[PeersBulk] Parsed ${rows.length} rows`);

  // 3. Build lookup map: symbol -> peers
  const peerMap = new Map<string, string>();

  for (const row of rows) {
    const symbol = row.symbol || row.ticker;
    const peers = row.peers || row.peersList;

    if (symbol && peers) {
      peerMap.set(symbol, peers);
    }
  }

  // 4. FETCH ACTIVE UNIVERSE
  const activeStockTickers = await getActiveStockTickers(supabase);
  console.log(`[PeersBulk] Active Universe: ${activeStockTickers.length} tickers`);

  if (!activeStockTickers.length) {
    throw new Error('Failed to load fintra_active_stocks (or empty)');
  }

  const activeSet = new Set(activeStockTickers);

  if (targetTicker) {
    console.log(`[PeersBulk] Filtering for single ticker: ${targetTicker}`);
    // If targetTicker is set, we ONLY process that one
    // But we need the map to be ready.
    // Actually, we can just filter the relations generation
  }

  // 5. Build relations
  const relations: {
    ticker: string;
    peer_ticker: string;
    source: string;
    confidence: string;
  }[] = [];

  // Filter if targetTicker is provided
  const tickersToProcess = targetTicker 
    ? (activeSet.has(targetTicker) ? [targetTicker] : []) 
    : activeStockTickers;

  let processedTickers = 0;

  for (const ticker of tickersToProcess) {
    if (targetTicker && ticker !== targetTicker) continue;
    if (processedTickers >= limit) break;

    const peersRaw = peerMap.get(ticker);
    if (!peersRaw) continue;

    const peers = peersRaw
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);

    for (const peer of peers) {
      if (peer === ticker) continue;
      if (!activeSet.has(peer)) continue;

      relations.push({
        ticker,
        peer_ticker: peer,
        source: 'fmp_peers_bulk',
        confidence: 'market',
      });
    }

    processedTickers++;
  }

  // 6. Upsert idempotente
  if (relations.length > 0) {
    const { error: upsertError } = await supabase
      .from('stock_peers')
      .upsert(relations, {
        onConflict: 'ticker,peer_ticker',
      });

    if (upsertError) {
      throw upsertError;
    }
  }

  return {
    status: 'ok',
    tickers_processed: processedTickers,
    relations_upserted: relations.length,
    limit: Number.isFinite(limit) ? limit : null,
  };
}
