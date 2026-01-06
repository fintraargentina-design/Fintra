import { supabase } from '@/lib/supabase';
// Point to the actual implementation or mock if it doesn't exist
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain'; 
import dayjs from 'dayjs';

// Adapter to match expected signature if needed
function calculateFGOS(fin: any, sectorStats: any) {
    // Assuming fin contains necessary fields or mapping is needed.
    // For now, this is a placeholder to satisfy the linter.
    // In reality, you'd map 'fin' properties to what calculateFGOSFromData expects.
    return calculateFGOSFromData(
        fin.ticker,
        { sector: fin.sector }, // Profile
        fin, // Ratios (assuming flattened)
        fin, // Metrics (assuming flattened)
        {},
        { price: 0 }
    );
}

const ENGINE_VERSION = 'fintra-engine@2.0.0';

export async function backfillSnapshotsForDate(date: string) {
  const asOf = dayjs(date);

  // 1. Obtener tickers con datos ese día
  const { data: tickers } = await supabase
    .from('datos_financieros')
    .select('ticker')
    .lte('period_end_date', date);

  if (!tickers || !tickers.length) return;

  for (const { ticker } of tickers) {
    // -----------------------------
    // 2. Financials vigentes
    // -----------------------------
    const { data: fin } = await supabase
      .from('datos_financieros')
      .select('*')
      .eq('ticker', ticker)
      .lte('period_end_date', date)
      .in('period_type', ['TTM','FY'])
      .order('period_end_date', { ascending: false })
      .limit(1)
      .single();

    if (!fin) continue;

    // -----------------------------
    // 3. Sector
    // -----------------------------
    const sector = fin.sector;
    if (!sector) continue;

    // -----------------------------
    // 4. Sector stats
    // -----------------------------
    const { data: statsRows } = await supabase
      .from('sector_stats')
      .select('*')
      .eq('sector', sector)
      .eq('stats_date', date);

    if (!statsRows || !statsRows.length) continue;

    const sectorStats: any = {};
    for (const r of statsRows) {
      sectorStats[r.metric] = {
        p10: r.p10,
        p25: r.p25,
        p50: r.p50,
        p75: r.p75,
        p90: r.p90
      };
    }

    // -----------------------------
    // 5. FGOS
    // -----------------------------
    const fgos = calculateFGOS(fin, sectorStats);

    // -----------------------------
    // 6. Valuación
    // -----------------------------
    const { data: valuation } = await supabase
      .from('datos_valuacion')
      .select('*')
      .eq('ticker', ticker)
      .eq('valuation_date', date)
      .eq('denominator_type', 'TTM')
      .single();

    // -----------------------------
    // 7. Performance
    // -----------------------------
    const { data: perfRows } = await supabase
      .from('datos_performance')
      .select('*')
      .eq('ticker', ticker)
      .eq('performance_date', date);

    const marketPosition: any = {};
    perfRows?.forEach((r: any) => {
      marketPosition[r.window_code] = r.return_percent;
    });

    // -----------------------------
    // 8. Verdict
    // -----------------------------
    const verdict = buildVerdict(fgos, valuation);

    // -----------------------------
    // 9. Snapshot final
    // TODO: Insert logic
  }
}

function buildVerdict(fgos: any, valuation: any) {
    if (!fgos || !valuation) return "Sin datos suficientes";
    // Implement simple logic or reuse fintra-brain
    return "Neutral";
}
