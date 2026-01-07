import { supabaseAdmin } from '@/lib/supabase-admin';
import { getBulkPriceData } from '../shared/bulkCache';
import dayjs from 'dayjs';

export async function backfillValuationForDate(date: string) {
  const asOf = dayjs(date);
  const pricesByTicker = await getBulkPriceData();

  const rows: any[] = [];

  for (const ticker of Object.keys(pricesByTicker)) {
    // -----------------------
    // 1. Precio del día
    // -----------------------
    const priceRow = pricesByTicker[ticker]
      .find((p: any) => p.date === date);

    if (!priceRow) continue;

    const price = priceRow.close;

    // -----------------------
    // 2. Fundamentals vigentes
    // -----------------------
    const { data: fin } = await supabaseAdmin
      .from('datos_financieros')
      .select('*')
      .eq('ticker', ticker)
      .lte('period_end_date', date)
      .in('period_type', ['TTM', 'FY'])
      .order('period_end_date', { ascending: false })
      .limit(1)
      .single();

    if (!fin) continue;

    // -----------------------
    // 3. Sector
    // -----------------------
    const sector =
      fin.sector ??
      (await resolveSectorFromSnapshot(ticker, date));

    if (!sector) continue;

    // -----------------------
    // 4. Múltiplos
    // -----------------------
    const marketCap =
      fin.total_equity && fin.book_value_per_share
        ? price * (fin.total_equity / fin.book_value_per_share)
        : null;

    const pe = safeDiv(price, fin.net_income && fin.net_income > 0 ? fin.net_income : undefined);
    const pfcf = safeDiv(price, fin.free_cash_flow && fin.free_cash_flow > 0 ? fin.free_cash_flow : undefined);

    // -----------------------
    // 5. Percentiles sectoriales
    // -----------------------
    const { data: stats } = await supabaseAdmin
      .from('sector_stats')
      .select('*')
      .eq('sector', sector)
      .eq('stats_date', date);

    if (!stats || !stats.length) continue;

    const peStats = stats.find((s: any) => s.metric === 'pe_ratio');
    const pfcfStats = stats.find((s: any) => s.metric === 'p_fcf');

    const pePercentile = percentileFromStats(pe, peStats);
    const pfcfPercentile = percentileFromStats(pfcf, pfcfStats);

    const composite =
      pePercentile && pfcfPercentile
        ? (pePercentile + pfcfPercentile) / 2
        : pePercentile ?? pfcfPercentile ?? null;

    const status =
      composite !== null
        ? composite <= 30
          ? 'Barata'
          : composite >= 70
          ? 'Cara'
          : 'Justa'
        : null;

    rows.push({
      ticker,
      valuation_date: date,

      denominator_type: fin.period_type,
      denominator_period: fin.period_label,

      price,
      market_cap: marketCap,

      pe_ratio: pe,
      // Add other fields if needed
      valuation_status: status,
      valuation_score: composite ? 100 - composite : null
    });
  }
}

// Helpers

async function resolveSectorFromSnapshot(ticker: string, date: string): Promise<string | null> {
    // Attempt to find sector from other sources or previous snapshots
    const { data } = await supabaseAdmin
        .from('fintra_snapshots')
        .select('sector')
        .eq('ticker', ticker)
        .limit(1)
        .single();
    return data?.sector || null;
}

function safeDiv(numerator: number, denominator?: number): number | null {
    if (!denominator || denominator === 0) return null;
    return numerator / denominator;
}

function percentileFromStats(value: number | null, stats: any): number | null {
    if (value === null || !stats) return null;
    // Simple interpolation or bucket finding
    if (value <= stats.p10) return 10;
    if (value <= stats.p25) return 25;
    if (value <= stats.p50) return 50;
    if (value <= stats.p75) return 75;
    if (value <= stats.p90) return 90;
    return 100;
}
