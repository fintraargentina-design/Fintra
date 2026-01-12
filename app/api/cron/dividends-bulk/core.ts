import { supabaseAdmin } from '@/lib/supabase-admin';
import { fmpGet } from '@/lib/fmp/server';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type DivRow = {
  date: string;
  dividend?: number;
  paymentDate?: string;
  declarationDate?: string;
};

type PriceRow = {
  date: string;
  close: number;
};

type RatioRow = {
  date: string;
  period: string;
  dividendPayoutRatio?: number;
  payoutRatio?: number;
  dividendPerShare?: number;
  freeCashFlowPerShare?: number;
};

type DivPayload = { historical?: DivRow[] } | DivRow[];
type PricePayload = { historical?: PriceRow[] } | PriceRow[];
type RatioPayload = RatioRow[];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function parseList<T extends { date: string }>(raw: any): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && Array.isArray(raw.historical)) return raw.historical as T[];
  return [];
}

const fmtYear = (d: string) => new Date(d).getFullYear();

export async function runDividendsBulk(targetTicker?: string) {
  try {
    let tickers: string[] = [];

    if (targetTicker) {
      console.log(`[Dividends Cron] Debug mode: processing only ${targetTicker}`);
      tickers = [targetTicker];
    } else {
      // 1. Get active tickers from fintra_universe
      // We use the same pattern as other crons: fetch all active tickers
      console.log('[Dividends Cron] Fetching active tickers...');
      const BATCH_SIZE = 1000;
      let page = 0;
      const allTickers = new Set<string>();

      while (true) {
        const { data, error } = await supabaseAdmin
          .from('fintra_universe')
          .select('ticker')
          .eq('is_active', true)
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

        if (error) throw new Error(`Error fetching tickers: ${error.message}`);
        if (!data || data.length === 0) break;

        data.forEach(d => {
            if (d.ticker) allTickers.add(d.ticker);
        });

        if (data.length < BATCH_SIZE) break;
        page++;
      }
      tickers = Array.from(allTickers);
    }
    
    console.log(`[Dividends Cron] Processing ${tickers.length} tickers...`);

    const results = {
      processed: 0,
      errors: 0,
      details: [] as string[]
    };

    // Process in parallel with concurrency limit
    // (Using a simple loop for clarity/safety in this context)
    for (const ticker of tickers) {
      try {
        await processTicker(ticker);
        results.processed++;
      } catch (err: any) {
        console.error(`[Dividends Cron] Error processing ${ticker}:`, err);
        results.errors++;
        results.details.push(`${ticker}: ${err.message}`);
      }
    }

    return {
      success: true,
      stats: results,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    console.error('[Dividends Cron] Fatal error:', error);
    throw error;
  }
}

async function processTicker(symbol: string) {
  // 10 years lookback
  const to = new Date();
  const from = new Date(to.getFullYear() - 10, 0, 1).toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  // Fetch Data (Parallel)
  const [divsRaw, pricesRaw, ratiosRaw] = await Promise.all([
    fmpGet<DivPayload>(`/api/v3/historical-price-full/stock_dividend/${symbol}`, { from, to: toStr }),
    fmpGet<PricePayload>(`/api/v3/historical-price-full/${symbol}`, { from, to: toStr }),
    fmpGet<RatioPayload>(`/api/v3/ratios/${symbol}`, { limit: 10, period: 'annual' }) // Fetch historical ratios
  ]);

  // Parse & Normalize
  const divs = parseList<DivRow>(divsRaw)
    .filter((d) => d?.date && d?.dividend !== undefined && Number.isFinite(d.dividend))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (divs.length === 0) {
    // No dividends? Nothing to store (or maybe store "no dividends"? Rule says "Skip years with no data")
    return;
  }

  const prices = parseList<PriceRow>(pricesRaw).sort((a, b) => a.date.localeCompare(b.date));
  const ratios = parseList<RatioRow>(ratiosRaw).sort((a, b) => a.date.localeCompare(b.date));

  // ─────────────────────────────────────────────
  // Aggregation by Year
  // ─────────────────────────────────────────────
  const yearsMap = new Map<number, {
    dps: number;
    count: number;
    pricesSum: number;
    pricesCount: number;
    ratios?: RatioRow;
  }>();

  // 1. Sum Dividends & Count
  for (const d of divs) {
    const y = fmtYear(d.date);
    const entry = yearsMap.get(y) ?? { dps: 0, count: 0, pricesSum: 0, pricesCount: 0 };
    entry.dps += (d.dividend ?? 0);
    entry.count += 1;
    yearsMap.set(y, entry);
  }

  // 2. Avg Price
  for (const p of prices) {
    const y = fmtYear(p.date);
    if (yearsMap.has(y)) {
      const entry = yearsMap.get(y)!;
      entry.pricesSum += Number(p.close);
      entry.pricesCount += 1;
    }
  }

  // 3. Match Ratios (Approximate by year)
  for (const r of ratios) {
    const y = fmtYear(r.date);
    if (yearsMap.has(y)) {
      const entry = yearsMap.get(y)!;
      // Keep the one closest to end of year or just the annual report for that year
      entry.ratios = r;
    }
  }

  const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => a - b);
  const upsertRows: any[] = [];

  for (let i = 0; i < sortedYears.length; i++) {
    const y = sortedYears[i];
    const data = yearsMap.get(y)!;
    
    // Derived Metrics
    const dps = +(data.dps.toFixed(4));
    const avgPrice = data.pricesCount > 0 ? data.pricesSum / data.pricesCount : null;
    const yieldPct = avgPrice ? +((dps / avgPrice) * 100).toFixed(2) : null;
    
    // Payouts
    let payoutEps: number | null = null;
    let payoutFcf: number | null = null;

    if (data.ratios) {
      // Use standard payout ratio (Dividends / Net Income)
      if (Number.isFinite(data.ratios.dividendPayoutRatio)) {
        payoutEps = +(data.ratios.dividendPayoutRatio! * 100).toFixed(2);
      } else if (Number.isFinite(data.ratios.payoutRatio)) {
         payoutEps = +(data.ratios.payoutRatio! * 100).toFixed(2);
      }

      // Calculate FCF Payout (DPS / FCF per share)
      if (Number.isFinite(data.ratios.dividendPerShare) && Number.isFinite(data.ratios.freeCashFlowPerShare)) {
         const fcf = data.ratios.freeCashFlowPerShare!;
         if (fcf !== 0) {
           payoutFcf = +((data.ratios.dividendPerShare! / fcf) * 100).toFixed(2);
         }
      }
    }

    // Flags
    const has_dividend = dps > 0;
    
    // Growth (vs prev year)
    let is_growing: boolean | null = null;
    const prevYear = y - 1;
    if (yearsMap.has(prevYear)) {
      const prevDps = yearsMap.get(prevYear)!.dps;
      is_growing = dps > prevDps;
    }

    // Stability (payments count vs neighbors)
    let is_stable: boolean | null = null;
    // Check neighbors exist
    const prevCount = yearsMap.get(y - 1)?.count;
    const nextCount = yearsMap.get(y + 1)?.count;
    
    // Logic: roughly consistent (±1)
    // If we have prev, check prev. If we have next, check next.
    // Ideally requires context. Let's say stable if consistent with AVAILABLE neighbors.
    const neighbors: number[] = [];
    if (prevCount !== undefined) neighbors.push(prevCount);
    if (nextCount !== undefined) neighbors.push(nextCount);
    
    if (neighbors.length > 0) {
      is_stable = neighbors.every(n => Math.abs(n - data.count) <= 1);
    }

    // Data Freshness
    const endOfYear = new Date(y, 11, 31);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - endOfYear.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    upsertRows.push({
      ticker: symbol,
      year: y,
      dividend_per_share: dps,
      dividend_yield: yieldPct,
      payments_count: data.count,
      payout_eps: payoutEps,
      payout_fcf: payoutFcf,
      has_dividend,
      is_growing,
      is_stable,
      data_freshness: diffDays,
      source: 'fmp'
    });
  }

  if (upsertRows.length > 0) {
    const { error } = await supabaseAdmin
      .from('datos_dividendos')
      .upsert(upsertRows, { onConflict: 'ticker,year' });
      
    if (error) throw error;
  }
}
