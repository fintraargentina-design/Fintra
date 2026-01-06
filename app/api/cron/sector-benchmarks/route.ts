import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_NAME = 'sector_benchmarks_builder';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const today = new Date().toISOString().slice(0, 10);

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
    // INPUT: SNAPSHOTS DEL DÍA
    // ─────────────────────────────────────────
    const { data: snapshots } = await supabase
      .from('fintra_snapshots')
      .select(`
        ticker,
        snapshot_date,
        profile_structural,
        performance
      `)
      .eq('snapshot_date', today);

    if (!snapshots?.length) {
      return NextResponse.json({ error: 'No snapshots for date' }, { status: 500 });
    }

    // ─────────────────────────────────────────
    // BUCKETS
    // ─────────────────────────────────────────
    const sectorBuckets: Record<string, any> = {};
    const industryBuckets: Record<string, any> = {};

    for (const s of snapshots) {
      const sector = s.profile_structural?.classification?.sector;
      const industry = s.profile_structural?.classification?.industry;
      const p = s.performance ?? {};

      if (sector) {
        sectorBuckets[sector] ??= {
          return_1y: [],
          return_5y: [],
          volatility_1y: []
        };
        if (Number.isFinite(p.return_1y)) sectorBuckets[sector].return_1y.push(p.return_1y);
        if (Number.isFinite(p.return_5y)) sectorBuckets[sector].return_5y.push(p.return_5y);
        if (Number.isFinite(p.volatility_1y)) sectorBuckets[sector].volatility_1y.push(p.volatility_1y);
      }

      if (industry) {
        industryBuckets[industry] ??= {
          return_1y: [],
          return_5y: [],
          volatility_1y: []
        };
        if (Number.isFinite(p.return_1y)) industryBuckets[industry].return_1y.push(p.return_1y);
        if (Number.isFinite(p.return_5y)) industryBuckets[industry].return_5y.push(p.return_5y);
        if (Number.isFinite(p.volatility_1y)) industryBuckets[industry].volatility_1y.push(p.volatility_1y);
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
    const sectorRows: any[] = [];
    for (const [sector, metrics] of Object.entries(sectorBuckets)) {
      for (const [metric, values] of Object.entries(metrics)) {
        const stats = percentiles(values as number[]);
        if (!stats) continue;
        sectorRows.push({
          sector,
          metric,
          stats_date: today,
          ...stats
        });
      }
    }

    const industryRows: any[] = [];
    for (const [industry, metrics] of Object.entries(industryBuckets)) {
      for (const [metric, values] of Object.entries(metrics)) {
        const stats = percentiles(values as number[]);
        if (!stats) continue;
        industryRows.push({
          industry,
          metric,
          stats_date: today,
          ...stats
        });
      }
    }

    // ─────────────────────────────────────────
    // UPSERT
    // ─────────────────────────────────────────
    if (sectorRows.length) {
      await supabase
        .from('sector_benchmarks')
        .upsert(sectorRows, { onConflict: 'sector,metric,stats_date' });
    }

    if (industryRows.length) {
      await supabase
        .from('industry_benchmarks')
        .upsert(industryRows, { onConflict: 'industry,metric,stats_date' });
    }

    // ─────────────────────────────────────────
    // CURSOR UPDATE
    // ─────────────────────────────────────────
    await supabase
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
      mode: 'FINTRA v2 – SECTOR / INDUSTRY BENCHMARKS'
    });

  } catch (e: any) {
    console.error('SECTOR BENCHMARKS ERROR', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
