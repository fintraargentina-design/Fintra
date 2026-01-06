// Fintra/app/api/cron/fmp-bulk/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { fetchAllFmpData } from './fetchBulk';
import { buildSnapshot } from './buildSnapshots';
import { upsertSnapshots } from './upsertSnapshots';


export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_NAME = 'fmp_bulk_snapshots';
const MIN_COVERAGE = 0.7;

// 🔎 DEBUG: ticker puntual
const DEBUG_TICKER = 'AAPL'; // ← CAMBIÁ SI QUERÉS

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '100');

  const fmpKey = process.env.FMP_API_KEY!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  if (!fmpKey || !supabaseKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    const tStart = performance.now();
    const today = new Date().toISOString().slice(0, 10);

    // Cursor
    const { data: state } = await supabase
      .from('cron_state')
      .select('last_run_date')
      .eq('name', CRON_NAME)
      .single();

    if (state?.last_run_date === today) {
      return NextResponse.json({ skipped: true, date: today });
    }

    // Fetch BULKs
    const { profiles, ratios, metrics, scores } = await fetchAllFmpData(fmpKey);

    // Universo activo
    const { data: activeStocks } = await supabase
      .from('fintra_active_stocks')
      .select('ticker');

    if (!activeStocks) throw new Error('No active stocks');

    const tickers = activeStocks.map(s => s.ticker).slice(0, limit);

    const snapshotsToUpsert: any[] = [];

    for (const sym of tickers) {
      const profile = profiles.get(sym)?.[0];
      if (!profile) continue;

      // 🧪 DEBUG INPUT
      if (sym === DEBUG_TICKER) {
        console.log('🧪 DEBUG INPUT', {
          sym,
          profile,
          ratios: ratios.get(sym)?.[0],
          metrics: metrics.get(sym)?.[0],
        });
      }

      const snapshot = buildSnapshot(
        sym,
        profile,
        ratios.get(sym)?.[0] ?? {},
        metrics.get(sym)?.[0] ?? {},
        {},
        {},
        scores.get(sym)?.[0] ?? {}
      );

      // 🧪 DEBUG OUTPUT
      if (sym === DEBUG_TICKER) {
        console.log('🧪 DEBUG OUTPUT', snapshot);
      }

      if (snapshot) {
        snapshot.snapshot_date = today;
        snapshotsToUpsert.push(snapshot);
      }
    }

    // Upsert
    const CHUNK_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < snapshotsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = snapshotsToUpsert.slice(i, i + CHUNK_SIZE);
      await upsertSnapshots(supabase, chunk);
      inserted += chunk.length;
    }

    // Benchmarks sectoriales
    await supabase.rpc('build_sector_fgos_benchmarks', {
      snap_date: today
    });

    // ALERTA A
    if (inserted === 0) {
      await sendCriticalAlert(
        `🚨 FINTRA ALERTA\nCron corrió sin inserts.\nFecha: ${today}`
      );
    }

    // ALERTA B
    const { data: coverage } = await supabase.rpc(
      'fintra_snapshot_coverage',
      { snap_date: today }
    );

    if (Number(coverage) < MIN_COVERAGE) {
      await sendCriticalAlert(
        `🚨 FINTRA ALERTA\nCoverage bajo.\nFecha: ${today}\nCoverage: ${(Number(coverage) * 100).toFixed(1)}%`
      );
    }

    // ALERTA C
    const { data: sanityIssues } = await supabase.rpc(
      'fintra_fgos_sanity_issues',
      { snap_date: today }
    );

    if (Number(sanityIssues) > 0) {
      await sendCriticalAlert(
        `🚨 FINTRA ALERTA\nFGOS inválido detectado.\nFecha: ${today}\nRegistros: ${sanityIssues}`
      );
    }

    // Update cursor
    await supabase
      .from('cron_state')
      .upsert({ name: CRON_NAME, last_run_date: today });

    const tEnd = performance.now();

    return NextResponse.json({
      success: true,
      date: today,
      processed: tickers.length,
      inserted,
      coverage,
      sanity_issues: sanityIssues,
      time_ms: Math.round(tEnd - tStart),
      mode: 'FINTRA v2 CSV BULK + DEBUG FASE 2'
    });

  } catch (e: any) {
    console.error('CSV BULK ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function sendCriticalAlert(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });
}
