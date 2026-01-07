import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import type { SectorBenchmarkRow } from '@/lib/engine/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_NAME = 'sector_stats_builder';

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  try {
    // ─────────────────────────────────────────
    // CURSOR
    // ─────────────────────────────────────────
    const { data: state } = await supabaseAdmin
      .from('cron_state')
      .select('last_run_date')
      .eq('name', CRON_NAME)
      .single();

    if (state?.last_run_date === today) {
      return NextResponse.json({ skipped: true, date: today });
    }

    // ─────────────────────────────────────────
    // INPUT: SNAPSHOTS DEL DÍA
    // ─────────────────────────────────────────
    const { data: snapshots } = await supabaseAdmin
      .from('fintra_snapshots')
      .select(`
        ticker,
        snapshot_date,
        profile_structural,
        valuation
      `)
      .eq('snapshot_date', today);

    if (!snapshots?.length) {
      return NextResponse.json({ error: 'No snapshots for date' }, { status: 500 });
    }

    // ─────────────────────────────────────────
    // AGREGACIÓN
    // ─────────────────────────────────────────
    const sectorBuckets: Record<string, { pe: number[]; ev_ebitda: number[]; price_to_fcf: number[] }> = {};
    const industryBuckets: Record<string, { pe: number[]; ev_ebitda: number[]; price_to_fcf: number[] }> = {};

    for (const s of snapshots) {
      const sector = s.profile_structural?.classification?.sector;
      const industry = s.profile_structural?.classification?.industry;
      const v = s.valuation ?? {};

      if (sector) {
        sectorBuckets[sector] ??= {
          pe: [],
          ev_ebitda: [],
          price_to_fcf: []
        };
        if (Number.isFinite(v.pe_ratio)) sectorBuckets[sector].pe.push(v.pe_ratio);
        if (Number.isFinite(v.ev_ebitda)) sectorBuckets[sector].ev_ebitda.push(v.ev_ebitda);
        if (Number.isFinite(v.price_to_fcf)) sectorBuckets[sector].price_to_fcf.push(v.price_to_fcf);
      }

      if (industry) {
        industryBuckets[industry] ??= {
          pe: [],
          ev_ebitda: [],
          price_to_fcf: []
        };
        if (Number.isFinite(v.pe_ratio)) industryBuckets[industry].pe.push(v.pe_ratio);
        if (Number.isFinite(v.ev_ebitda)) industryBuckets[industry].ev_ebitda.push(v.ev_ebitda);
        if (Number.isFinite(v.price_to_fcf)) industryBuckets[industry].price_to_fcf.push(v.price_to_fcf);
      }
    }

    // ─────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────
    function percentiles(values: number[]) {
      if (!values.length) return null;
      const v = [...values].sort((a, b) => a - b);
      const p = (q: number) => v[Math.floor(q * (v.length - 1))];
      return {
        p10: p(0.1),
        p25: p(0.25),
        p50: p(0.5),
        p75: p(0.75),
        p90: p(0.9)
      };
    }

    // ─────────────────────────────────────────
    // BUILD ROWS
    // ─────────────────────────────────────────
    const sectorRows: SectorBenchmarkRow[] = [];
    for (const [sector, metrics] of Object.entries(sectorBuckets)) {
      for (const [metric, values] of Object.entries(metrics)) {
        const count = values.length;
        if (count < 3) continue;

        const stats = percentiles(values as number[]);
        if (!stats) continue;

        let confidence: 'low' | 'medium' | 'high' = 'high';
        if (count < 10) confidence = 'low';
        else if (count < 20) confidence = 'medium';

        sectorRows.push({
          sector,
          metric,
          stats_date: today,
          sample_size: count,
          confidence_level: confidence,
          ...stats
        });
      }
    }

    const industryRows: SectorBenchmarkRow[] = [];
    for (const [industry, metrics] of Object.entries(industryBuckets)) {
      for (const [metric, values] of Object.entries(metrics)) {
        const count = values.length;
        if (count < 3) continue;

        const stats = percentiles(values as number[]);
        if (!stats) continue;

        let confidence: 'low' | 'medium' | 'high' = 'high';
        if (count < 10) confidence = 'low';
        else if (count < 20) confidence = 'medium';

        industryRows.push({
          industry,
          metric,
          stats_date: today,
          sample_size: count,
          confidence_level: confidence,
          ...stats
        });
      }
    }

    // ─────────────────────────────────────────
    // UPSERT
    // ─────────────────────────────────────────
    if (sectorRows.length) {
      await supabaseAdmin
        .from('sector_stats')
        .upsert(sectorRows, { onConflict: 'sector,metric,stats_date' });
    }

    if (industryRows.length) {
      await supabaseAdmin
        .from('industry_stats')
        .upsert(industryRows, { onConflict: 'industry,metric,stats_date' });
    }

    // ─────────────────────────────────────────
    // CURSOR UPDATE
    // ─────────────────────────────────────────
    await supabaseAdmin
      .from('cron_state')
      .upsert({
        name: CRON_NAME,
        last_run_date: today
      });

    return NextResponse.json({
      success: true,
      date: today,
      sector_metrics: sectorRows.length,
      industry_metrics: industryRows.length,
      mode: 'FINTRA v2 – SECTOR / INDUSTRY STATS'
    });

  } catch (e: any) {
    console.error('SECTOR STATS ERROR', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
