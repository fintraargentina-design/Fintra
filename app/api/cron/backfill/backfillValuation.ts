import { supabaseAdmin } from '@/lib/supabase-admin';
import dayjs from 'dayjs';

export async function backfillValuationForDate(date: string) {
  // -----------------------
  // 0. Fetch Snapshots (Canonical Source)
  // -----------------------
  // Lookback 7 days to find the latest valid snapshot
  const lookbackDate = dayjs(date).subtract(7, 'day').format('YYYY-MM-DD');
  
  const { data: snapshots, error } = await supabaseAdmin
      .from('fintra_snapshots')
      .select('ticker, profile_structural, snapshot_date, sector')
      .lte('snapshot_date', date)
      .gte('snapshot_date', lookbackDate)
      .not('profile_structural->metrics->price', 'is', null)
      .order('snapshot_date', { ascending: false });

  if (error) {
      console.error(`[backfillValuation] Error fetching snapshots:`, error);
      return;
  }

  if (!snapshots || snapshots.length === 0) {
      console.log(`[backfillValuation] No snapshots found for window ${lookbackDate} to ${date}`);
      return;
  }

  // Dedup: keep latest snapshot per ticker
  const snapshotMap = new Map<string, any>();
  for (const s of snapshots) {
      if (!snapshotMap.has(s.ticker)) {
          snapshotMap.set(s.ticker, s);
      }
  }

  console.log(`[backfillValuation] Processing ${snapshotMap.size} tickers for target date ${date}`);

  const rows: any[] = [];

  for (const ticker of snapshotMap.keys()) {
    const snap = snapshotMap.get(ticker);
    
    // -----------------------
    // 1. Precio from Snapshot
    // -----------------------
    const rawPrice = snap.profile_structural?.metrics?.price;
    const price = typeof rawPrice === 'string' ? parseFloat(rawPrice) : rawPrice;

    if (price === null || price === undefined || !Number.isFinite(price)) continue;

    // Use snapshot date as the effective valuation date
    const valuationDate = snap.snapshot_date;

    // -----------------------
    // 2. Fundamentals vigentes
    // -----------------------
    const { data: fin } = await supabaseAdmin
      .from('datos_financieros')
      .select('*')
      .eq('ticker', ticker)
      .lte('period_end_date', valuationDate)
      .in('period_type', ['TTM', 'FY'])
      .order('period_end_date', { ascending: false })
      .limit(1)
      .single();

    if (!fin) continue;

    // -----------------------
    // 3. Sector
    // -----------------------
    // Use snapshot sector if available, otherwise financial sector, otherwise resolve
    const sector = snap.sector ?? fin.sector ?? (await resolveSectorFromSnapshot(ticker, valuationDate));

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
      .eq('stats_date', valuationDate);

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
      valuation_date: valuationDate,

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

  // -----------------------
  // 6. Upsert
  // -----------------------
  if (rows.length > 0) {
      console.log(`[backfillValuation] Upserting ${rows.length} rows...`);
      const { error: upsertError } = await supabaseAdmin
          .from('datos_valuacion')
          .upsert(rows, {
              onConflict: 'ticker,valuation_date,denominator_type,denominator_period'
          });
      
      if (upsertError) {
          console.error('[backfillValuation] Upsert error:', upsertError);
      } else {
          console.log(`[backfillValuation] Upsert successful.`);
      }
  } else {
      console.log(`[backfillValuation] No rows to upsert.`);
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
