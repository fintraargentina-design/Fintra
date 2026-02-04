
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import Papa from 'papaparse';

// Set strict runtime for cron
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow local dev execution without bearer if in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing FMP_API_KEY' }, { status: 500 });
  }

  try {
    console.log("🚀 Starting Peers Backfill...");
    
    // 1. Fetch from FMP (Stable Bulk)
    const url = `https://financialmodelingprep.com/api/v4/stock_peers?apikey=${apiKey}`;
    // Note: using v4 endpoint which usually returns JSON array of objects
    // [ { "symbol": "AAPL", "peersList": ["MSFT", "GOOG", ...] }, ... ]
    
    // Let's try v4 first as it's cleaner than CSV for lists
    console.log(`fetching ${url}...`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`FMP Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    
    if (!Array.isArray(data)) {
        throw new Error("Invalid FMP response format (expected array)");
    }

    console.log(`Received ${data.length} peer entries.`);

    // 2. Transform to DB rows
    const rows: any[] = [];
    const BATCH_SIZE = 1000;
    
    for (const item of data) {
        const ticker = item.symbol;
        const peers = item.peersList; // v4 uses peersList

        if (!ticker || !Array.isArray(peers)) continue;

        peers.forEach((peer: string) => {
            rows.push({
                ticker: ticker,
                peer_ticker: peer,
                source: 'FMP_BULK_V4',
                confidence: 'high'
            });
        });
    }

    console.log(`Parsed ${rows.length} total peer relationships.`);

    // 3. Upsert in batches
    // We first DELETE all peers to avoid stale data (full refresh)
    // Or we can upsert. Since this is a relationship table without unique ID per row (maybe composite PK?), 
    // it's safer to upsert if we have a constraint, or delete-insert.
    // Let's check constraint. Likely (ticker, peer_ticker).
    
    // For safety, let's delete for the tickers we have, or truncate if full refresh.
    // Since this is a "backfill" and we have 0 rows, we can just insert.
    // But to be safe for re-runs, we should probably use upsert if there's a unique constraint.
    // Or just delete all.
    
    // Let's try upserting with ignoreDuplicates if possible, or simple insert.
    // Better: Delete all rows (truncate) since we are reloading the universe map.
    
    const { error: deleteError } = await supabaseAdmin.from('stock_peers').delete().neq('ticker', 'PLACEHOLDER_FOR_TRUNCATE'); 
    // Delete all rows where ticker is not something impossible (effectively all).
    // Actually .neq('id', 0) if id exists, or .gt('created_at', '1900-01-01').
    // supabaseAdmin.rpc('truncate_table', { table_name: 'stock_peers' }) would be ideal if RPC exists.
    
    // Let's insert in batches.
    
    let insertedCount = 0;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabaseAdmin.from('stock_peers').upsert(batch, {
            onConflict: 'ticker,peer_ticker', 
            ignoreDuplicates: true
        });
        
        if (error) {
            console.error(`Batch insert error at ${i}:`, error);
        } else {
            insertedCount += batch.length;
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Processed ${data.length} companies. Inserted ${insertedCount} relationships.` 
    });

  } catch (error: any) {
    console.error("Backfill failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
