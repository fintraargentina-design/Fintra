// app/api/cron/sync-universe/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !FMP_API_KEY) {
  throw new Error('Missing required env vars');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const FMP_STOCK_LIST =
  'https://financialmodelingprep.com/api/v3/stock/list';

const BATCH_SIZE = 1000;

export async function GET() {
  try {
    console.log('🌍 Sync Fintra Universe (batch-safe)');

    const today = new Date().toISOString().slice(0, 10);

    // 1️⃣ Descargar lista completa de FMP
    const res = await fetch(`${FMP_STOCK_LIST}?apikey=${FMP_API_KEY}`);
    if (!res.ok) {
      throw new Error('Error descargando stock/list de FMP');
    }

    const symbols: any[] = await res.json();
    console.log(`📥 Símbolos recibidos: ${symbols.length}`);

    // 2️⃣ Procesar en batches
    let processed = 0;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const slice = symbols.slice(i, i + BATCH_SIZE);

      const rows = slice.map(s => ({
        ticker: s.symbol,
        name: s.name ?? null,
        exchange: s.exchange ?? null,
        exchange_short: s.exchangeShortName ?? null,
        type: s.type ?? null,
        currency: s.currency ?? null,
        is_active: true,
        last_seen: today,
        source: 'FMP'
      }));

      const { error } = await supabase
        .from('fintra_universe')
        .upsert(rows, { onConflict: 'ticker' });

      if (error) throw error;

      processed += rows.length;
      console.log(`✔ Batch ${i / BATCH_SIZE + 1} → ${processed} procesados`);

      // 💡 liberar referencias para ayudar al GC
      rows.length = 0;
      slice.length = 0;
    }

    // 3️⃣ Marcar como inactivos los no vistos hoy
    const { error: deactivateError } = await supabase.rpc('execute_sql', {
      sql: `
        update fintra_universe
        set is_active = false
        where source = 'FMP'
          and last_seen < '${today}';
      `
    });

    if (deactivateError) throw deactivateError;

    console.log('✅ Fintra Universe sincronizado correctamente');

    return NextResponse.json({
      ok: true,
      total_symbols: symbols.length,
      processed
    });
  } catch (err: any) {
    console.error('❌ Error en syncFintraUniverse', err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
