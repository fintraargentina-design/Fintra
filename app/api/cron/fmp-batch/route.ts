// Fintra\app\api\cron\fmp-batch\route.ts

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadFmpBulkOnce } from '@/lib/fmp/loadFmpBulkOnce';
import { processTickerFromBulk } from '@/lib/fmp/processTickerFromBulk';


export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabase = supabaseAdmin;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const offset = Number(searchParams.get('offset') ?? 0);
  // Removed default limit for cron execution
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : null;

  // 1️⃣ Tomar tickers SOLO del universo operativo
  // Use fintra_active_stocks exclusively (per FINTRA business rule) to ensure equity-only calculations
  let query = supabase
    .from('fintra_active_stocks')
    .select('ticker')
    .eq('is_active', true)
    .eq('type', 'stock');

  if (limit) {
       query = query.range(offset, offset + limit - 1);
   } else {
       // Fetch large batch if no limit specified (Supabase default is 1000)
       // Assuming < 10000 active stocks
       query = query.range(offset, offset + 9999);
   }

  // To be safe and cleaner in the replacement:
  const { data: rows, error } = await query;

  if (error) throw error;

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const tickers = rows.map((r: { ticker: string }) => r.ticker);
  const fmp = await loadFmpBulkOnce();

    for (const ticker of tickers) {
    await processTickerFromBulk(ticker, fmp);
    }


  // ⚠️ TODAVÍA NO PROCESAMOS NADA
  // Solo validamos que el batch funcione

  return NextResponse.json({
    ok: true,
    offset,
    processed: tickers.length,
    tickers
  });
}
