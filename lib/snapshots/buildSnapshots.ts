import { calculateFGOS } from '@/lib/fgos/calculateFGOS';
import { supabase } from '@/lib/supabase';

const ENGINE_VERSION = 'fintra-engine@2.0.0';

export async function buildSnapshot(ticker: string, snapshotDate: string) {
  // -----------------------
  // 1. Financials (TTM)
  // -----------------------
  const { data: financials } = await supabase
    .from('datos_financieros')
    .select('*')
    .eq('ticker', ticker)
    .in('period_type', ['TTM', 'FY'])
    .order('period_end_date', { ascending: false })
    .limit(1)
    .single();

  if (!financials) return null;

  // -----------------------
  // 2. Sector stats
  // -----------------------
  const sector =
    financials.sector ??
    (await resolveSectorFromSnapshot(ticker));

  const { data: sectorStatsRows } = await supabase
    .from('sector_stats')
    .select('*')
    .eq('sector', sector)
    .eq('stats_date', snapshotDate);

  const sectorStats = mapSectorStats(sectorStatsRows);

  // -----------------------
  // 3. FGOS
  // -----------------------
  const fgos = calculateFGOS(financials, sectorStats);

  // -----------------------
  // 4. Valuation
  // -----------------------
  const { data: valuation } = await supabase
    .from('datos_valuacion')
    .select('*')
    .eq('ticker', ticker)
    .eq('valuation_date', snapshotDate)
    .eq('denominator_type', 'TTM')
    .single();
    
    // ...
}

async function resolveSectorFromSnapshot(ticker: string) {
    const { data } = await supabase
        .from('fintra_snapshots')
        .select('sector')
        .eq('ticker', ticker)
        .limit(1)
        .single();
    return data?.sector || null;
}

function mapSectorStats(rows: any[] | null) {
    if (!rows) return {};
    const stats: any = {};
    for (const r of rows) {
        stats[r.metric] = {
            p10: r.p10,
            p25: r.p25,
            p50: r.p50,
            p75: r.p75,
            p90: r.p90
        };
    }
    return stats;
}

function mapPerformance(rows: any[]) {
    // Implement if needed or remove usage
    return {};
}

function buildVerdict(fgos: any, valuation: any) {
    return "Neutral";
}
