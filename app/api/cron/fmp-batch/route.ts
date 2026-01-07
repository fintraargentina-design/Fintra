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
  const limit = Number(searchParams.get('limit') ?? 10); // chico para probar

  // 1️⃣ Tomar tickers SOLO del universo operativo
  const { data: rows, error } = await supabase
    .from('fintra_active_stocks')
    .select('ticker')
    .range(offset, offset + limit - 1);

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
