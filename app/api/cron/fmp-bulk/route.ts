// Fintra/app/api/cron/fmp-bulk/route.ts

// Fintra/app/api/cron/fmp-bulk/route.ts

import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { fetchAllFmpData } from './fetchBulk';
import { buildSnapshot } from './buildSnapshots';
import { upsertSnapshots } from './upsertSnapshots';
import { resolveValuationFromSector } from '@/lib/engine/resolveValuationFromSector';
import type { ValuationResult } from '@/lib/engine/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_NAME = 'fmp_bulk_snapshots';
const MIN_COVERAGE = 0.7;
const DEBUG_TICKER = 'AAPL';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '100');

  const fmpKey = process.env.FMP_API_KEY!;

  if (!fmpKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }
  const supabase = supabaseAdmin;

  const today = new Date().toISOString().slice(0, 10);
  const tStart = performance.now();

  try {
    // ─────────────────────────────────────────
    // CURSOR
    // ─────────────────────────────────────────
    const { data: state } = await supabase
      .from('cron_state')
      .select('last_run_date')
      .eq('name', CRON_NAME)
      .single();

    if (state?.last_run_date === today) {
      return NextResponse.json({ skipped: true, date: today });
    }

    // ─────────────────────────────────────────
    // FETCH BULKS
    // ─────────────────────────────────────────
    const bulk = await fetchAllFmpData(fmpKey);
    const { profiles, ratios, metrics, scores } = bulk;

    // ─────────────────────────────────────────
    // SECTOR STATS
    // ─────────────────────────────────────────
    const { data: sectorStatsRows } = await supabase
      .from('sector_stats')
      .select('*')
      .eq('stats_date', today);

    const sectorStatsMap: Record<string, any> = {};
    for (const row of sectorStatsRows ?? []) {
      sectorStatsMap[row.sector] ??= {};
      sectorStatsMap[row.sector][row.metric] = row;
    }

    // ─────────────────────────────────────────
    // UNIVERSO ACTIVO
    // ─────────────────────────────────────────
    const { data: activeStocks } = await supabase
      .from('fintra_active_stocks')
      .select('ticker');

    if (!activeStocks?.length) {
      return NextResponse.json({ error: 'No active stocks' }, { status: 500 });
    }

    const tickers = activeStocks.map((s: { ticker: string }) => s.ticker).slice(0, limit);
    const snapshotsToUpsert: any[] = [];

    const discardStats: Record<string, number> = {};

    // ─────────────────────────────────────────
    // LOOP PRINCIPAL
    // ─────────────────────────────────────────
    for (const sym of tickers) {
      try {
        const profile = profiles.get(sym)?.[0] ?? null;

          if (!profile) {
            console.warn('⚠️ PROFILE MISSING (bulk)', sym);
          }


        const snapshot = buildSnapshot(
          sym,
          profile,
          ratios.get(sym)?.[0] ?? {},
          metrics.get(sym)?.[0] ?? {},
          bulk.quotes.get(sym)?.[0] ?? {},
          {},
          scores.get(sym)?.[0] ?? {},
          bulk.income_growth.get(sym) ?? [],
          bulk.cashflow_growth.get(sym) ?? []
        );

        if (!snapshot) {
          const discard = (global as any).__LAST_DISCARD_REASON__;

          const reason =
            discard?.sym === sym ? discard.reason : 'unknown';

          discardStats[reason] = (discardStats[reason] ?? 0) + 1;

          console.warn('📉 TICKER DISCARDED', {
            sym,
            reason
          });

          continue;
        }

        const sector =
          snapshot.profile_structural?.classification?.sector ?? null;

        if (sector && sectorStatsMap[sector]) {
          const valuationResolved = resolveValuationFromSector(
            {
              sector,
              pe_ratio: snapshot.valuation?.pe_ratio,
              ev_ebitda: snapshot.valuation?.ev_ebitda,
              price_to_fcf: snapshot.valuation?.price_to_fcf
            },
            sectorStatsMap[sector]
          );

          const baseValuation: ValuationResult = snapshot.valuation ?? {
            pe_ratio: null,
            ev_ebitda: null,
            price_to_fcf: null,
            valuation_status: 'Pending'
          };

          snapshot.valuation = {
            pe_ratio: baseValuation.pe_ratio,
            ev_ebitda: baseValuation.ev_ebitda,
            price_to_fcf: baseValuation.price_to_fcf,
            valuation_status: valuationResolved.valuation_status,
            intrinsic_value: baseValuation.intrinsic_value ?? null,
            upside_potential: baseValuation.upside_potential ?? null
          };
        }

        snapshot.snapshot_date = today;
        snapshotsToUpsert.push(snapshot);

        if (sym === DEBUG_TICKER) {
          console.log('🧪 DEBUG SNAPSHOT FINAL', snapshot);
        }
      } catch (err) {
        discardStats['exception'] =
          (discardStats['exception'] ?? 0) + 1;

        console.warn(`⚠️ SNAPSHOT ERROR ${sym}`, err);
        continue;
      }
    }

    // ─────────────────────────────────────────
    // UPSERT
    // ─────────────────────────────────────────
    const CHUNK_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < snapshotsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = snapshotsToUpsert.slice(i, i + CHUNK_SIZE);
      try {
        await upsertSnapshots(supabase, chunk);
        inserted += chunk.length;
      } catch (err) {
        console.error('❌ UPSERT CHUNK FAILED', err);
      }
    }

    // ─────────────────────────────────────────
    // REBUILD STATS
    // ─────────────────────────────────────────
    try {
      await supabase.rpc('build_sector_stats', { snap_date: today });
    } catch {}

    console.log('📊 DISCARD SUMMARY', discardStats);

    // ─────────────────────────────────────────
    // ALERTAS
    // ─────────────────────────────────────────
    if (inserted === 0) {
      await sendCriticalAlert(
        `🚨 FINTRA ALERTA\nCron sin inserts.\nFecha: ${today}`
      );
    }

    const { data: coverage } = await supabase.rpc(
      'fintra_snapshot_coverage',
      { snap_date: today }
    );

    if (Number(coverage) < MIN_COVERAGE) {
      await sendCriticalAlert(
        `🚨 FINTRA ALERTA\nCoverage bajo.\nFecha: ${today}\nCoverage: ${(Number(coverage) * 100).toFixed(1)}%`
      );
    }

    const tEnd = performance.now();

    return NextResponse.json({
      success: true,
      date: today,
      processed: tickers.length,
      inserted,
      coverage,
      time_ms: Math.round(tEnd - tStart),
      discard_stats: discardStats,
      mode: 'FINTRA v2 – BULK ESTABLE'
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
