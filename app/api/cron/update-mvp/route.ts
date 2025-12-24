import { NextResponse } from 'next/server';
import { calculateFGOS } from '@/lib/engine/fintra-brain';
import { supabase } from '@/lib/supabase';

// Esta ruta debe ser protegida con un secreto de Cron en producción
export const dynamic = 'force-dynamic';

const WATCHLIST_MVP = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'MELI', 'GLOB'];

export async function GET(req: Request) {
  // Verificación básica de autorización (opcional, para Vercel Cron)
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  console.log('Iniciando FGOS Cron Job...');
  const results = [];
  const errors = [];

  for (const ticker of WATCHLIST_MVP) {
    try {
      console.log(`Procesando ${ticker}...`);
      const data = await calculateFGOS(ticker);
      
      if (data) {
        // Upsert en Supabase
        const { error: dbError } = await supabase
          .from('fintra_snapshots')
          .upsert({
            ticker: data.ticker,
            fgos_score: data.fgos_score,
            fgos_breakdown: data.fgos_breakdown,
            valuation_status: data.valuation_status,
            ecosystem_score: data.ecosystem_score,
            price_at_calculation: data.price,
            calculated_at: data.calculated_at
          }, { onConflict: 'ticker' });

        if (dbError) {
          console.error(`Error guardando ${ticker}:`, dbError);
          errors.push({ ticker, error: dbError.message });
        } else {
          results.push(data.ticker);
        }
      } else {
        errors.push({ ticker, error: 'No data returned from engine' });
      }
    } catch (err: any) {
      console.error(`Excepción procesando ${ticker}:`, err);
      errors.push({ ticker, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
    errors
  });
}
