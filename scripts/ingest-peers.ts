
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Create Supabase Admin Client locally to avoid import issues with aliases in scripts if not handled perfectly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fmpKey = process.env.FMP_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !fmpKey) {
  console.error('Missing environment variables. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and FMP_API_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  try {
    console.log("🚀 Starting Peers Ingestion...");
    
    // 1. Fetch from FMP (Stable Bulk)
    const url = `https://financialmodelingprep.com/api/v4/stock_peers?apikey=${fmpKey}`;
    console.log(`fetching ${url.replace(fmpKey || '', '...')}`);
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`FMP Error: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    // console.log("Raw response preview:", text.slice(0, 500)); 

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error("Failed to parse JSON response");
    }

    if (!Array.isArray(data)) {
        console.log("Response type:", typeof data);
        if (typeof data === 'object') {
             console.log("Response keys:", Object.keys(data));
             if (data['Error Message']) console.error("FMP Error Message:", data['Error Message']);
        }
        throw new Error("Invalid FMP response format (expected array)");
    }

    if (data.length === 0) {
        console.warn("⚠️ Bulk endpoint returned 0 entries. Switching to per-ticker fetch for top stocks...");
        
        // Fetch top 30 tickers by market cap (or just existing snapshots) to seed data
        const { data: topSnapshots, error } = await supabaseAdmin
            .from('fintra_snapshots')
            .select('ticker')
            .not('profile_structural', 'is', null)
            .limit(30);
            
        if (error) {
            throw new Error(`Failed to fetch top snapshots: ${error.message}`);
        }
        
        console.log(`Fetched ${topSnapshots.length} top tickers to seed peers.`);
        
        const manualRows: any[] = [];
        
        for (const row of topSnapshots) {
            const ticker = row.ticker;
            const pUrl = `https://financialmodelingprep.com/api/v4/stock_peers?symbol=${ticker}&apikey=${fmpKey}`;
            try {
                const pRes = await fetch(pUrl);
                if (!pRes.ok) continue;
                const pData = await pRes.json();
                // pData is array of objects: [ { symbol: 'AAPL', peersList: [...] } ]
                if (Array.isArray(pData) && pData.length > 0) {
                    const item = pData[0];
                    if (item.symbol && Array.isArray(item.peersList)) {
                        console.log(`Found ${item.peersList.length} peers for ${item.symbol}`);
                        item.peersList.forEach((peer: string) => {
                            manualRows.push({
                                ticker: item.symbol,
                                peer_ticker: peer,
                                source: 'FMP_MANUAL_SEED',
                                confidence: 'high'
                            });
                        });
                    }
                }
            } catch (err) {
                console.error(`Error fetching peers for ${ticker}:`, err);
            }
        }
        
        // Use manual rows if bulk failed
        const BATCH_SIZE = 1000;
        let insertedCount = 0;
        for (let i = 0; i < manualRows.length; i += BATCH_SIZE) {
            const batch = manualRows.slice(i, i + BATCH_SIZE);
            const { error } = await supabaseAdmin.from('stock_peers').upsert(batch, {
                onConflict: 'ticker,peer_ticker', 
                ignoreDuplicates: true
            });
            if (!error) insertedCount += batch.length;
            else console.error("Batch insert error:", error);
        }
        console.log(`✅ Successfully seeded via manual fetch. Inserted ${insertedCount} relationships.`);
        return;
    }

    console.log(`Received ${data.length} peer entries.`);

    // 2. Transform to DB rows
    const rows: any[] = [];
    
    for (const item of data) {
        const ticker = item.symbol;
        const peers = item.peersList; 

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

    if (rows.length === 0) {
        console.log("No rows to insert.");
        return;
    }

    // 3. Upsert in batches
    const BATCH_SIZE = 2000;
    let insertedCount = 0;
    
    // Optional: Truncate/Delete old data?
    // For now, let's just upsert.
    
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
            if (i % 10000 === 0) process.stdout.write('.');
        }
    }
    
    console.log(`\n✅ Successfully processed. Inserted/Upserted ${insertedCount} relationships.`);

  } catch (error: any) {
    console.error("Ingestion failed:", error);
    process.exit(1);
  }
}

main();
