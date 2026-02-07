import Papa from 'papaparse';
import fs from 'fs/promises';
import path from 'path';
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

  const sampleRows = rows.slice(0, 3).map((r: any) => ({
    symbol: r.symbol,
    ticker: r.ticker,
    peers: r.peers,
    peersList: r.peersList,
  }));
  console.log('[PeersBulk] Sample rows:', JSON.stringify(sampleRows, null, 2));

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

  const sampleUniverse = activeStockTickers.slice(0, 10);
  console.log('[PeersBulk] Sample active tickers:', sampleUniverse.join(', '));

  if (!activeStockTickers.length) {
    throw new Error('Failed to load fintra_active_stocks (or empty)');
  }

  const activeSet = new Set(activeStockTickers);

  if (targetTicker) {
    console.log(`[PeersBulk] Filtering for single ticker: ${targetTicker}`);
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

  let tickersWithPeers = 0;
  let totalRawPeers = 0;

  for (const ticker of tickersToProcess) {
    if (targetTicker && ticker !== targetTicker) continue;
    if (processedTickers >= limit) break;

    const peersRaw = peerMap.get(ticker);
    if (!peersRaw) {
      continue;
    }

    const peers = peersRaw
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);

    totalRawPeers += peers.length;

    let addedForTicker = 0;

    for (const peer of peers) {
      if (peer === ticker) continue;
      if (!activeSet.has(peer)) continue;

      relations.push({
        ticker,
        peer_ticker: peer,
        source: 'fmp_peers_bulk',
        confidence: 'market',
      });

      addedForTicker++;
    }

    if (addedForTicker > 0) {
      tickersWithPeers++;
    }

    processedTickers++;
  }

  // 6. Upsert idempotente (CHUNKED PARALLEL)
    if (relations.length > 0) {
      console.log(
        `[PeersBulk] Built ${relations.length} relations for ${tickersWithPeers} tickers (avg raw peers per ticker: ${tickersWithPeers ? (totalRawPeers / tickersWithPeers).toFixed(2) : 0})`
      );

      const CHUNK_SIZE = 5000;
      const chunks = [];
      for (let i = 0; i < relations.length; i += CHUNK_SIZE) {
        chunks.push(relations.slice(i, i + CHUNK_SIZE));
      }

      console.log(`[PeersBulk] Upserting ${relations.length} rows in ${chunks.length} parallel chunks...`);

      await Promise.all(
        chunks.map(async (chunk, idx) => {
          const { error: upsertError } = await supabase
            .from('stock_peers')
            .upsert(chunk, {
              onConflict: 'ticker,peer_ticker',
            });

          if (upsertError) {
            console.error(`[PeersBulk] Error upserting chunk ${idx + 1}/${chunks.length}:`, upsertError);
            throw upsertError;
          }
        })
      );
    }

  return {
    status: 'ok',
    tickers_processed: processedTickers,
    relations_upserted: relations.length,
    tickers_with_peers: tickersWithPeers,
    limit: Number.isFinite(limit) ? limit : null,
  };
}

// Variante: usar CSV local ya descargado en data/fmp-peers-bulk/peers.csv
export async function runPeersBulkFromFile(
  filePath?: string,
  targetTicker?: string,
  limit: number = Infinity
) {
  console.log(`[PeersBulkFromFile] Starting run from local CSV... Target: ${targetTicker || 'ALL'}`);
  const supabase = supabaseAdmin;

  const resolvedPath = filePath || path.join(process.cwd(), 'data', 'fmp-peers-bulk', 'peers.csv');
  console.log(`[PeersBulkFromFile] Reading ${resolvedPath}...`);

  const csv = await fs.readFile(resolvedPath, 'utf8');

  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data as any[];
  console.log(`[PeersBulkFromFile] Parsed ${rows.length} rows`);

  const peerMap = new Map<string, string>();

  for (const row of rows) {
    const symbol = row.symbol || row.ticker;
    const peers = row.peers || row.peersList;

    if (symbol && peers) {
      peerMap.set(symbol, peers);
    }
  }

  const activeStockTickers = await getActiveStockTickers(supabase);
  console.log(`[PeersBulkFromFile] Active Universe: ${activeStockTickers.length} tickers`);

  if (!activeStockTickers.length) {
    throw new Error('Failed to load fintra_active_stocks (or empty)');
  }

  const activeSet = new Set(activeStockTickers);

  const tickersToProcess = targetTicker
    ? activeSet.has(targetTicker) ? [targetTicker] : []
    : activeStockTickers;

  const relations: {
    ticker: string;
    peer_ticker: string;
    source: string;
    confidence: string;
  }[] = [];

  let processedTickers = 0;
  let tickersWithPeers = 0;
  let totalRawPeers = 0;

  for (const ticker of tickersToProcess) {
    if (targetTicker && ticker !== targetTicker) continue;
    if (processedTickers >= limit) break;

    const peersRaw = peerMap.get(ticker);
    if (!peersRaw) continue;

    const peers = peersRaw
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);

    totalRawPeers += peers.length;

    let addedForTicker = 0;

    for (const peer of peers) {
      if (peer === ticker) continue;
      if (!activeSet.has(peer)) continue;

      relations.push({
        ticker,
        peer_ticker: peer,
        source: 'fmp_peers_bulk',
        confidence: 'market',
      });

      addedForTicker++;
    }

    if (addedForTicker > 0) {
      tickersWithPeers++;
    }

    processedTickers++;
  }

  if (relations.length > 0) {
    console.log(
      `[PeersBulkFromFile] Built ${relations.length} relations for ${tickersWithPeers} tickers (avg raw peers per ticker: ${tickersWithPeers ? (totalRawPeers / tickersWithPeers).toFixed(2) : 0})`
    );

    const CHUNK_SIZE = 5000;
    const chunks = [];
    for (let i = 0; i < relations.length; i += CHUNK_SIZE) {
      chunks.push(relations.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[PeersBulkFromFile] Upserting ${relations.length} rows in ${chunks.length} parallel chunks...`);

    await Promise.all(
      chunks.map(async (chunk, idx) => {
        const { error: upsertError } = await supabase
          .from('stock_peers')
          .upsert(chunk, {
            onConflict: 'ticker,peer_ticker',
          });

        if (upsertError) {
          console.error(`[PeersBulkFromFile] Error upserting chunk ${idx + 1}/${chunks.length}:`, upsertError);
          throw upsertError;
        }
      })
    );
  }

  return {
    status: 'ok',
    source: 'file',
    file: resolvedPath,
    tickers_processed: processedTickers,
    relations_upserted: relations.length,
    tickers_with_peers: tickersWithPeers,
    limit: Number.isFinite(limit) ? limit : null,
  };
}
