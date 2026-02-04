import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadFmpBulkOnce } from '@/lib/fmp/loadFmpBulkOnce';
import { processTickerFromBulk } from '@/lib/fmp/processTickerFromBulk';

const supabase = supabaseAdmin;

export async function runFmpBatch(targetTicker?: string, limitParam?: number, offsetParam?: number) {
  const offset = offsetParam || 0;
  const limit = limitParam || null;

  let tickers: string[] = [];

  if (targetTicker) {
      console.log(`🧪 DEBUG MODE: Processing only ${targetTicker}`);
      tickers = [targetTicker];
  } else {
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

      const { data: rows, error } = await query;

      if (error) throw error;

      if (!rows || rows.length === 0) {
        return { ok: true, processed: 0 };
      }

      tickers = rows.map((r: { ticker: string }) => r.ticker);
  }

  const fmp = await loadFmpBulkOnce();

  for (const ticker of tickers) {
    await processTickerFromBulk(ticker, fmp);
  }

  // ⚠️ TODAVÍA NO PROCESAMOS NADA
  // Solo validamos que el batch funcione
  // (Wait, processTickerFromBulk likely does process something?)
  // The original comment says: "⚠️ TODAVÍA NO PROCESAMOS NADA // Solo validamos que el batch funcione"
  // But line 51 calls await processTickerFromBulk(ticker, fmp);
  // So it DOES process.

  return {
    ok: true,
    offset,
    processed: tickers.length,
    tickers
  };
}
