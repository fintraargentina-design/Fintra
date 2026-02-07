import { supabaseAdmin } from "@/lib/supabase-admin";
import { computeTTMv2, type QuarterTTMInput } from "@/lib/engine/ttm";

interface ValuationMetrics {
  price: number;
  price_date: string;
  market_cap: number | null;
  enterprise_value: number | null;
  pe_ratio: number | null;
  ev_ebitda: number | null;
  price_to_sales: number | null;
  price_to_fcf: number | null;
}

interface TTMMetrics {
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  net_income_ttm: number | null;
  eps_ttm: number | null;
  free_cash_flow_ttm: number | null;
  net_debt: number | null;
}

interface ProcessResult {
  ticker: string;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
  date?: string;
}

/**
 * Optimización Nivel 2: Detección y procesamiento en bloque
 * 1. Recupera fechas de últimos reportes (Q) y TTMs existentes para todo el lote.
 * 2. Filtra en memoria quién necesita actualización.
 * 3. Procesa solo los candidatos confirmados.
 */
export async function runIncrementalTTMValuationBulk(tickers: string[]): Promise<ProcessResult[]> {
  if (!tickers.length) return [];
  
  const results: ProcessResult[] = [];
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffDate = oneYearAgo.toISOString().slice(0, 10);

  // ──────────────────────────────────────────────
  // 1. Bulk Check (Phase 1) - Identify Candidates
  // ──────────────────────────────────────────────
  
  // A. Fetch latest Quarter dates for the batch (Lookback 1 year is safe for "latest")
  const { data: quarters, error: qError } = await supabaseAdmin
    .from("datos_financieros")
    .select("ticker, period_end_date")
    .in("ticker", tickers)
    .eq("period_type", "Q")
    .gte("period_end_date", cutoffDate);

  if (qError) {
    console.error("❌ Error fetching bulk quarters:", qError);
    return tickers.map(t => ({ ticker: t, status: 'error', reason: 'db_error_quarters' }));
  }

  // B. Fetch latest TTM dates for the batch
  const { data: ttms, error: tError } = await supabaseAdmin
    .from("datos_valuacion_ttm")
    .select("ticker, valuation_date")
    .in("ticker", tickers)
    .gte("valuation_date", cutoffDate);

  if (tError) {
    console.error("❌ Error fetching bulk TTMs:", tError);
    return tickers.map(t => ({ ticker: t, status: 'error', reason: 'db_error_ttms' }));
  }

  // C. In-Memory Analysis
  const candidates: { ticker: string; latestQ: string }[] = [];
  
  // Map ticker -> max(period_end_date)
  const lastQMap = new Map<string, string>();
  if (quarters) {
      for (const q of quarters) {
          const currentMax = lastQMap.get(q.ticker);
          if (!currentMax || q.period_end_date > currentMax) {
              lastQMap.set(q.ticker, q.period_end_date);
          }
      }
  }

  // Map ticker -> max(valuation_date)
  const lastTTMMap = new Map<string, string>();
  if (ttms) {
      for (const t of ttms) {
          const currentMax = lastTTMMap.get(t.ticker);
          if (!currentMax || t.valuation_date > currentMax) {
              lastTTMMap.set(t.ticker, t.valuation_date);
          }
      }
  }

  // Filter
  for (const ticker of tickers) {
      const latestQ = lastQMap.get(ticker);
      const latestTTM = lastTTMMap.get(ticker);

      if (!latestQ) {
          results.push({ ticker, status: 'skipped', reason: 'no_quarters_found' });
          continue;
      }

      // If we have a Quarter > TTM, OR no TTM at all -> Candidate
      if (!latestTTM || latestQ > latestTTM) {
          candidates.push({ ticker, latestQ });
      } else {
          results.push({ ticker, status: 'skipped', reason: 'up_to_date' });
      }
  }

  if (candidates.length === 0) {
      return results;
  }

  console.log(`⚡ [TTM Bulk] Found ${candidates.length} candidates needing update out of ${tickers.length}`);

  // ──────────────────────────────────────────────
  // 2. Process Candidates (Phase 2)
  // ──────────────────────────────────────────────
  const inserts: any[] = [];

  // Parallel processing of candidates to fetch data and compute metrics
  await Promise.all(
    candidates.map(async ({ ticker, latestQ }) => {
      try {
        const success = await processSingleCandidate(ticker, latestQ, inserts);
        if (success) {
          results.push({ ticker, status: 'created', date: latestQ });
        } else {
          results.push({ ticker, status: 'skipped', reason: 'insufficient_data_or_price' });
        }
      } catch (err) {
        console.error(`❌ Error processing candidate ${ticker}:`, err);
        results.push({ ticker, status: 'error', reason: 'processing_exception' });
      }
    })
  );

  // ──────────────────────────────────────────────
  // 3. Bulk Insert (Phase 3)
  // ──────────────────────────────────────────────
  if (inserts.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("datos_valuacion_ttm")
        .insert(inserts);
      
      if (insertError) {
          console.error("❌ Bulk Insert Error:", insertError);
          // Fallback: If bulk fails, maybe one dup key? But we checked logic.
          // Return errors for the batch if insert fails
          return results.map(r => r.status === 'created' ? { ...r, status: 'error', reason: 'bulk_insert_failed' } : r);
      }
  }

  return results;
}

// Helper: Process a single confirmed candidate
async function processSingleCandidate(ticker: string, targetDate: string, insertsBuffer: any[]): Promise<boolean> {
    // 1. Check idempotency (double check DB just in case, though logic above covers it)
    // Skipped for performance relying on memory check, DB constraints handle race conditions

    // 2. Get last 4 quarters relative to targetDate
    const { data: quarters, error: qError } = await supabaseAdmin
      .from("datos_financieros")
      .select("period_end_date, period_label, revenue, ebitda, net_income, eps, free_cash_flow, shares_outstanding, total_debt, cash_and_equivalents")
      .eq("ticker", ticker)
      .eq("period_type", "Q")
      .lte("period_end_date", targetDate)
      .order("period_end_date", { ascending: false })
      .limit(4);

    if (qError || !quarters || quarters.length < 4) {
        return false;
    }

    // Sort Chronological
    const chronQuarters = [...quarters].sort((a, b) => a.period_end_date.localeCompare(b.period_end_date));

    // 3. Compute TTM
    let ttmMetrics: TTMMetrics;
    let shares_outstanding: number | null;
    try {
        ttmMetrics = computeTTMv2(chronQuarters as QuarterTTMInput[]);
        const rawShares = chronQuarters[3].shares_outstanding;
        shares_outstanding = rawShares != null && rawShares > 0 ? rawShares : null;
    } catch (e) {
        return false; // computeTTMv2 throws if invalid input
    }

    // 4. Get Price
    const { data: priceData, error: pError } = await supabaseAdmin
        .from("datos_eod")
        .select("price_date, close")
        .eq("ticker", ticker)
        .lte("price_date", targetDate)
        .order("price_date", { ascending: false })
        .limit(1)
        .maybeSingle();
    
    if (pError || !priceData) return false;

    // 5. Compute Valuation
    const valuation = computeValuationMetrics(ttmMetrics, { price: priceData.close, price_date: priceData.price_date }, shares_outstanding);

    // 6. Buffer Insert
    insertsBuffer.push({
        ticker,
        valuation_date: targetDate,
        price: valuation.price,
        price_date: valuation.price_date,
        revenue_ttm: ttmMetrics.revenue_ttm,
        ebitda_ttm: ttmMetrics.ebitda_ttm,
        net_income_ttm: ttmMetrics.net_income_ttm,
        eps_ttm: ttmMetrics.eps_ttm,
        free_cash_flow_ttm: ttmMetrics.free_cash_flow_ttm,
        market_cap: valuation.market_cap,
        enterprise_value: valuation.enterprise_value,
        net_debt: ttmMetrics.net_debt,
        pe_ratio: valuation.pe_ratio,
        ev_ebitda: valuation.ev_ebitda,
        price_to_sales: valuation.price_to_sales,
        price_to_fcf: valuation.price_to_fcf,
        quarters_used: chronQuarters.map((q) => q.period_label).join(","),
    });

    return true;
}

// Logic duplicated from original script to keep pure core clean (or import if shared lib existed)
function computeValuationMetrics(
  ttm: TTMMetrics,
  priceData: { price: number; price_date: string },
  shares_outstanding: number | null,
): ValuationMetrics {
  const { price, price_date } = priceData;

  const market_cap = shares_outstanding && shares_outstanding > 0 ? price * shares_outstanding : null;
  const enterprise_value = market_cap != null && ttm.net_debt != null ? market_cap + ttm.net_debt : null;
  
  const pe_ratio = ttm.net_income_ttm != null && ttm.net_income_ttm > 0 && market_cap != null 
    ? market_cap / ttm.net_income_ttm : null;
    
  const ev_ebitda = ttm.ebitda_ttm != null && ttm.ebitda_ttm > 0 && enterprise_value != null 
    ? enterprise_value / ttm.ebitda_ttm : null;
    
  const price_to_sales = ttm.revenue_ttm != null && ttm.revenue_ttm > 0 && market_cap != null 
    ? market_cap / ttm.revenue_ttm : null;
    
  const price_to_fcf = ttm.free_cash_flow_ttm != null && ttm.free_cash_flow_ttm > 0 && market_cap != null 
    ? market_cap / ttm.free_cash_flow_ttm : null;

  return {
    price,
    price_date,
    market_cap,
    enterprise_value,
    pe_ratio,
    ev_ebitda,
    price_to_sales,
    price_to_fcf,
  };
}
