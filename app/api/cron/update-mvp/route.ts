import { NextResponse } from 'next/server';
import { calculateFGOS } from '@/lib/engine/fintra-brain';
import { supabase } from '@/lib/supabase';

// Prevent this route from being cached
export const dynamic = 'force-dynamic';

// List of tickers for MVP
const WATCHLIST_MVP = ['AAPL', 'MELI', 'TSLA', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META'];

export async function GET(request: Request) {
  // Optional: Add a secret key check for security (e.g., Cron header or query param)
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  const results = [];
  const errors = [];

  console.log('[Cron] Starting MVP update...');

  for (const ticker of WATCHLIST_MVP) {
    try {
      console.log(`[Cron] Processing ${ticker}...`);
      const snapshot = await calculateFGOS(ticker);

      if (snapshot) {
        // Upsert into Supabase
        const { error } = await supabase
          .from('fintra_snapshots')
          .upsert(
            {
              symbol: snapshot.symbol,
              date: snapshot.date,
              fgos_score: snapshot.fgos_score,
              fgos_breakdown: snapshot.fgos_breakdown,
              valuation_status: snapshot.valuation_status,
              ecosystem_score: snapshot.ecosystem_score,
            },
            { onConflict: 'symbol,date' }
          );

        if (error) {
          console.error(`[Cron] Error saving ${ticker}:`, error);
          errors.push({ ticker, error: error.message });
        } else {
          results.push(snapshot.symbol);
        }
      } else {
        errors.push({ ticker, error: 'Calculation returned null' });
      }
    } catch (err) {
      console.error(`[Cron] Unexpected error for ${ticker}:`, err);
      errors.push({ ticker, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
    errors,
  });
}
