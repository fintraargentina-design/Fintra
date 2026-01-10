
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { recomputeFGOSForTicker } from '@/lib/engine/fgos-recompute';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos timeout en Vercel Pro

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sector = searchParams.get('sector');
    const tickerParam = searchParams.get('ticker');
    const limitParam = searchParams.get('limit');
    
    if (!sector && !tickerParam) {
      return NextResponse.json({ error: 'Missing sector or ticker parameter' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    // Removed default limit of 50 to allow full Supabase cron processing
    const limit = limitParam ? parseInt(limitParam) : null;

    console.log(`[recompute-fgos] Starting recompute. Sector: ${sector}, Ticker: ${tickerParam} (Limit: ${limit || 'Unlimited'})`);

    // 1. Fetch target snapshots for TODAY
    let query = supabaseAdmin
      .from('fintra_snapshots')
      .select('ticker')
      .eq('snapshot_date', today);

    if (tickerParam) {
        query = query.eq('ticker', tickerParam);
    } else if (sector) {
        query = query.eq('sector', sector);
    }

    if (limit) {
        query = query.limit(limit);
    } else {
        // Ensure we fetch all records if no limit is specified (Supabase defaults to 1000)
        query = query.limit(10000);
    }

    const { data: snapshots, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!snapshots || snapshots.length === 0) {
      return NextResponse.json({ message: `No snapshots found for today (${today}) matching criteria` }, { status: 404 });
    }

    const uniqueTickers = Array.from(new Set(snapshots.map(s => s.ticker)));
    console.log(`[recompute-fgos] Found ${uniqueTickers.length} unique tickers.`);

    const results = {
      total: uniqueTickers.length,
      success: 0,
      pending: 0,
      failed: 0,
      details: [] as any[]
    };

    // 2. Iterate sequentially (Safe & Deterministic)
    for (const ticker of uniqueTickers) {
      try {
        console.log(`[recompute-fgos] Processing ${ticker}...`);
        const res = await recomputeFGOSForTicker(ticker, today);
        
        if (res.status === 'pending') {
            results.pending++;
            results.details.push({ ticker, status: 'pending', reason: (res as any).reason });
        } else {
            results.success++;
            results.details.push({ ticker, status: 'ok', score: res.score });
        }
        
      } catch (err: any) {
        console.error(`[recompute-fgos] Error processing ${ticker}:`, err);
        results.failed++;
        results.details.push({ ticker, status: 'error', error: err.message });
      }
    }

    return NextResponse.json({
      message: `Recompute complete`,
      data: results
    });

  } catch (error: any) {
    console.error('[recompute-fgos] Critical error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
