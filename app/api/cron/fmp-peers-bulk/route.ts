import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabase = supabaseAdmin;

export async function GET(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Query params
    // --------------------------------------------------
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || Infinity;

    // --------------------------------------------------
    // 2. Fetch peers BULK (CSV)
    // --------------------------------------------------
    const url = `https://financialmodelingprep.com/stable/peers-bulk?apikey=${process.env.FMP_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: 'FMP peers-bulk fetch failed' },
        { status: 500 }
      );
    }

    const csv = await res.text();

    // --------------------------------------------------
    // 3. Parse CSV
    // --------------------------------------------------
    const parsed = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data as any[];

    // --------------------------------------------------
    // 4. Build lookup map: symbol -> peers
    // --------------------------------------------------
    const peerMap = new Map<string, string>();

    for (const row of rows) {
      const symbol = row.symbol || row.ticker;
      const peers = row.peers || row.peersList;

      if (symbol && peers) {
        peerMap.set(symbol, peers);
      }
    }

    // --------------------------------------------------
    // ─────────────────────────────────────────
    // 5. FETCH ACTIVE UNIVERSE
    // ─────────────────────────────────────────
    const activeStockTickers = await getActiveStockTickers(supabase);

    if (!activeStockTickers.length) {
      return NextResponse.json(
        { error: 'Failed to load fintra_active_stocks (or empty)' },
        { status: 500 }
      );
    }

    const activeSet = new Set(activeStockTickers);

    // --------------------------------------------------
    // 6. Build relations (limit applies to active tickers)
    // --------------------------------------------------
    const relations: {
      ticker: string;
      peer_ticker: string;
      source: string;
      confidence: string;
    }[] = [];

    let processedTickers = 0;

    for (const ticker of activeStockTickers) {
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
          source: 'FMP',
          confidence: 'market',
        });
      }

      processedTickers++;
    }

    // --------------------------------------------------
    // 7. Upsert idempotente
    // --------------------------------------------------
    if (relations.length > 0) {
      const { error: upsertError } = await supabase
        .from('stock_peers')
        .upsert(relations, {
          onConflict: 'ticker,peer_ticker',
        });

      if (upsertError) {
        return NextResponse.json(
          { error: upsertError.message },
          { status: 500 }
        );
      }
    }

    // --------------------------------------------------
    // 8. Response
    // --------------------------------------------------
    return NextResponse.json({
      status: 'ok',
      tickers_processed: processedTickers,
      relations_upserted: relations.length,
      limit: Number.isFinite(limit) ? limit : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
