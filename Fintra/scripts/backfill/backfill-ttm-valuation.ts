/**
 * BACKFILL: datos_valuacion_ttm table
 *
 * PURPOSE:
 * Populate historical TTM valuation metrics from quarterly financials
 *
 * ARCHITECTURE:
 * - Reads quarterly financials from datos_financieros (period_type = 'Q')
 * - Computes TTM by summing last 4 closed quarters
 * - Fetches nearest price <= quarter_end_date from datos_eod
 * - Calculates valuation ratios (PE, EV/EBITDA, P/S, P/FCF)
 * - Inserts into datos_valuacion_ttm (Layer 2: Pre-calculated)
 *
 * DATA RULES (STRICTLY ENFORCED):
 * - TTM requires EXACTLY 4 closed quarters (skip if fewer)
 * - If ANY quarter has NULL for a metric → TTM metric is NULL (do NOT treat as 0)
 * - FY data MUST NOT be used as proxy
 * - valuation_date = quarter_end_date of most recent quarter
 * - price = nearest closing price <= valuation_date
 * - EPS computed as: net_income_ttm / shares_outstanding (NOT sum of quarterly EPS)
 * - No interpolation, estimation, or approximation allowed
 * - Idempotent: skip if (ticker, valuation_date) already exists
 * - Insert row if 4 quarters + price exist (ratios can be NULL independently)
 *
 * USAGE:
 * pnpm tsx scripts/backfill/backfill-ttm-valuation.ts          # All tickers
 * pnpm tsx scripts/backfill/backfill-ttm-valuation.ts AAPL    # Single ticker
 * pnpm tsx scripts/backfill/backfill-ttm-valuation.ts --limit=10  # First 10 tickers
 */

import { loadEnv } from "../utils/load-env";
import { computeTTMv2, type QuarterTTMInput } from "@/lib/engine/ttm";

loadEnv();

// OPERATIONAL SAFETY LIMITS
const BATCH_SIZE = 100;
const MAX_TICKERS_PER_RUN = 100; // Hard limit to prevent RAM spikes and Supabase throttling

/**
 * Sleep helper to prevent Supabase throttling and RAM spikes
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface QuarterData {
  period_end_date: string;
  period_label: string;
  revenue: number | null;
  ebitda: number | null;
  net_income: number | null;
  free_cash_flow: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
  weighted_shares_out: number | null;
}

interface TTMMetrics {
  revenue_ttm: number | null;
  ebitda_ttm: number | null;
  net_income_ttm: number | null;
  eps_ttm: number | null;
  free_cash_flow_ttm: number | null;
  net_debt: number | null;
}

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

async function getAllActiveTickers(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  let allTickers: string[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  let to = PAGE_SIZE - 1;

  process.stdout.write("   Scanning universe");

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("fintra_universe")
      .select("ticker")
      .eq("is_active", true)
      .order("ticker", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("\n❌ Error fetching tickers:", error);
      break;
    }

    if (!data || data.length === 0) {
      break;
    }

    const tickers = data.map((t) => t.ticker);
    allTickers = allTickers.concat(tickers);
    process.stdout.write(".");

    if (data.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
    to += PAGE_SIZE;
  }

  console.log(`\n   ✅ Found ${allTickers.length} active tickers in universe`);
  return allTickers;
}

async function filterProcessedTickers(tickers: string[]): Promise<string[]> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  if (tickers.length === 0) return [];

  // Check which of these tickers already have data in the target table
  const { data: processedTickers, error } = await supabaseAdmin
    .from("datos_valuacion_ttm")
    .select("ticker")
    .in("ticker", tickers);

  if (error) {
    console.error("❌ Error checking processed status:", error);
    return tickers; // Assume none processed on error to be safe, or empty? Safe to retry.
  }

  const processedSet = new Set(processedTickers?.map((t) => t.ticker) || []);
  return tickers.filter((t) => !processedSet.has(t));
}

async function getQuarterlyFinancials(ticker: string): Promise<QuarterData[]> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("datos_financieros")
    .select(
      "period_end_date, period_label, revenue, ebitda, net_income, free_cash_flow, total_debt, cash_and_equivalents, weighted_shares_out",
    )
    .eq("ticker", ticker)
    .eq("period_type", "Q")
    .order("period_end_date", { ascending: true });

  if (error) {
    console.error(
      `   ❌ Error fetching quarters for ${ticker}:`,
      error.message,
    );
    return [];
  }

  return data || [];
}

async function getNearestPrice(
  ticker: string,
  targetDate: string,
): Promise<{ price: number; price_date: string } | null> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("prices_daily")
    .select("price_date, close")
    .eq("ticker", ticker)
    .lte("price_date", targetDate)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `   ❌ Error fetching price for ${ticker} on ${targetDate}:`,
      error.message,
    );
    return null;
  }

  if (!data) {
    return null;
  }

  return { price: data.close, price_date: data.price_date };
}

async function ttmRowExists(
  ticker: string,
  valuationDate: string,
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("datos_valuacion_ttm")
    .select("valuation_date")
    .eq("ticker", ticker)
    .eq("valuation_date", valuationDate)
    .maybeSingle();

  if (error) {
    console.error(`   ⚠️  Error checking existing TTM:`, error.message);
    return false;
  }

  return !!data;
}

/**
 * Compute TTM metrics using canonical TTM v2 engine
 * This is a thin wrapper that delegates to lib/engine/ttm.ts
 */
function computeTTMMetrics(quarters: QuarterData[]): TTMMetrics {
  // Map QuarterData to QuarterTTMInput format
  const mappedQuarters: QuarterTTMInput[] = quarters.map((q) => ({
    period_end_date: q.period_end_date,
    period_label: q.period_label,
    revenue: q.revenue,
    ebitda: q.ebitda,
    net_income: q.net_income,
    free_cash_flow: q.free_cash_flow,
    shares_outstanding: q.weighted_shares_out,
    total_debt: q.total_debt,
    cash_and_equivalents: q.cash_and_equivalents,
  }));

  // Delegate to canonical TTM v2 engine
  // This ensures backfill and incremental produce identical results
  return computeTTMv2(mappedQuarters);
}

function computeValuationMetrics(
  ttm: TTMMetrics,
  priceData: { price: number; price_date: string },
  shares_outstanding: number | null,
): ValuationMetrics {
  const { price, price_date } = priceData;

  // Market cap
  const market_cap =
    shares_outstanding && shares_outstanding > 0
      ? price * shares_outstanding
      : null;

  // Enterprise value
  const enterprise_value =
    market_cap != null && ttm.net_debt != null
      ? market_cap + ttm.net_debt
      : null;

  // PE ratio (only if positive earnings)
  const pe_ratio =
    ttm.net_income_ttm != null && ttm.net_income_ttm > 0 && market_cap != null
      ? market_cap / ttm.net_income_ttm
      : null;

  // EV/EBITDA (only if positive EBITDA)
  const ev_ebitda =
    ttm.ebitda_ttm != null && ttm.ebitda_ttm > 0 && enterprise_value != null
      ? enterprise_value / ttm.ebitda_ttm
      : null;

  // Price to Sales
  const price_to_sales =
    ttm.revenue_ttm != null && ttm.revenue_ttm > 0 && market_cap != null
      ? market_cap / ttm.revenue_ttm
      : null;

  // Price to FCF (only if positive FCF)
  const price_to_fcf =
    ttm.free_cash_flow_ttm != null &&
    ttm.free_cash_flow_ttm > 0 &&
    market_cap != null
      ? market_cap / ttm.free_cash_flow_ttm
      : null;

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

async function insertTTMRow(
  ticker: string,
  valuationDate: string,
  ttm: TTMMetrics,
  valuation: ValuationMetrics,
  quartersUsed: string[],
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { error } = await supabaseAdmin.from("datos_valuacion_ttm").insert({
    ticker,
    valuation_date: valuationDate,
    price: valuation.price,
    revenue_ttm: ttm.revenue_ttm,
    ebitda_ttm: ttm.ebitda_ttm,
    net_income_ttm: ttm.net_income_ttm,
    eps_ttm: ttm.eps_ttm,
    free_cash_flow_ttm: ttm.free_cash_flow_ttm,
    market_cap: valuation.market_cap,
    enterprise_value: valuation.enterprise_value,
    net_debt: ttm.net_debt,
    pe_ratio: valuation.pe_ratio,
    ev_ebitda: valuation.ev_ebitda,
    price_to_sales: valuation.price_to_sales,
    price_to_fcf: valuation.price_to_fcf,
    source: "backfill",
  });

  if (error) {
    console.error(`   ❌ Error inserting TTM row:`, error.message);
    return false;
  }

  return true;
}

async function processTickerBackfill(
  ticker: string,
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  // 1. Get all quarterly financials
  const quarters = await getQuarterlyFinancials(ticker);

  if (quarters.length < 4) {
    console.log(`   ⏭️  Insufficient quarters (${quarters.length}/4)`);
    return { inserted, skipped };
  }

  // Explicitly sort by period_end_date to ensure chronological order
  quarters.sort((a, b) => a.period_end_date.localeCompare(b.period_end_date));

  // 2. Iterate through possible TTM windows
  for (let i = 3; i < quarters.length; i++) {
    const last4 = quarters.slice(i - 3, i + 1);
    const valuationDate = last4[3].period_end_date;
    const quartersUsed = last4.map((q) => q.period_label);

    // Check if already exists (idempotent)
    const exists = await ttmRowExists(ticker, valuationDate);
    if (exists) {
      skipped++;
      continue;
    }

    // 3. Compute TTM metrics
    let ttmMetrics: TTMMetrics;
    let shares_outstanding: number | null;
    try {
      ttmMetrics = computeTTMMetrics(last4);

      // Validate weighted_shares_out: use only if positive
      const rawShares = last4[3].weighted_shares_out;
      shares_outstanding =
        rawShares != null && rawShares > 0 ? rawShares : null;
    } catch (error) {
      console.log(
        `   ⚠️  Skipping ${valuationDate}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      skipped++;
      continue;
    }

    // 4. Get nearest price (REQUIRED - skip if missing)
    const priceData = await getNearestPrice(ticker, valuationDate);
    if (!priceData) {
      console.log(`   ⚠️  Skipping ${valuationDate}: no price data`);
      skipped++;
      continue;
    }

    // 5. Compute valuation metrics
    // Note: Individual ratios will be NULL if inputs are missing
    const valuationMetrics = computeValuationMetrics(
      ttmMetrics,
      priceData,
      shares_outstanding,
    );

    // 6. Insert row
    const success = await insertTTMRow(
      ticker,
      valuationDate,
      ttmMetrics,
      valuationMetrics,
      quartersUsed,
    );

    if (success) {
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

async function main() {
  console.log("🚀 Starting TTM Valuation Backfill...\n");
  console.log("═══════════════════════════════════════════════════════════");

  // Parse arguments
  const args = process.argv.slice(2);
  const singleTicker = args.find((a) => !a.startsWith("--"));
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const userLimit = limitArg ? parseInt(limitArg, 10) : undefined;

  // SINGLE TICKER MODE
  if (singleTicker) {
    console.log(`📌 Single ticker mode: ${singleTicker}\n`);
    const { inserted, skipped } = await processTickerBackfill(singleTicker);
    console.log(
      "\n═══════════════════════════════════════════════════════════",
    );
    console.log("✨ Backfill Complete!\n");
    console.log(`   Inserted:  ${inserted} TTM rows`);
    console.log(`   Skipped:   ${skipped} rows`);
    console.log(
      "═══════════════════════════════════════════════════════════\n",
    );
    return;
  }

  // BATCH MODE: Process in batches

  // 1. Fetch ALL active tickers (paginated)
  const allTickers = await getAllActiveTickers();

  let batchNumber = 1;
  let grandTotalInserted = 0;
  let grandTotalSkipped = 0;
  let grandTotalProcessed = 0;
  let grandTotalErrors = 0;

  // 2. Iterate through the universe in chunks
  for (let i = 0; i < allTickers.length; i += MAX_TICKERS_PER_RUN) {
    const batchTickersRaw = allTickers.slice(i, i + MAX_TICKERS_PER_RUN);

    console.log(`\n🔄 BATCH ${batchNumber}`);
    console.log(
      `📋 Checking status for ${batchTickersRaw.length} tickers (${i + 1}-${Math.min(i + MAX_TICKERS_PER_RUN, allTickers.length)} of ${allTickers.length})...`,
    );

    // 3. Filter out already processed ones from this batch
    // This prevents the infinite loop on failed items because we move forward in the main list regardless
    const pendingTickers = await filterProcessedTickers(batchTickersRaw);

    if (pendingTickers.length === 0) {
      console.log(
        `   ⏭️  All ${batchTickersRaw.length} tickers in this batch are already processed.`,
      );
      batchNumber++;
      continue;
    }

    console.log(
      `   📊 Processing ${pendingTickers.length} pending tickers in this batch\n`,
    );

    let batchInserted = 0;
    let batchSkipped = 0;
    let batchProcessed = 0;
    let batchErrors = 0;

    for (const ticker of pendingTickers) {
      try {
        console.log(
          `\n[${grandTotalProcessed + 1}/${allTickers.length}] ${ticker}`,
        );

        const { inserted, skipped } = await processTickerBackfill(ticker);

        batchInserted += inserted;
        batchSkipped += skipped;

        if (inserted > 0) {
          console.log(`   ✅ Inserted ${inserted} TTM rows`);
        }
        if (skipped > 0) {
          console.log(
            `   ⏭️  Skipped ${skipped} rows (existing or incomplete data)`,
          );
        }

        batchProcessed++;
        grandTotalProcessed++;
      } catch (error) {
        console.error(
          `   ❌ Fatal error processing ${ticker}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        batchErrors++;
        grandTotalErrors++;
      }

      // CRITICAL: Controlled delay
      await sleep(150);
    }

    // Update grand totals
    grandTotalInserted += batchInserted;
    grandTotalSkipped += batchSkipped;

    console.log(
      "\n───────────────────────────────────────────────────────────",
    );
    console.log(`✅ Batch ${batchNumber} Complete!\n`);
    console.log(`   Inserted:  ${batchInserted} TTM rows`);
    console.log(`   Skipped:   ${batchSkipped} rows`);
    console.log(
      "───────────────────────────────────────────────────────────\n",
    );

    // Optional: Allow user to set a batch limit (global limit check)
    if (userLimit && grandTotalProcessed >= userLimit) {
      console.log(
        `⚠️  User limit of ${userLimit} tickers reached. Stopping.\n`,
      );
      break;
    }

    batchNumber++;
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🎊 FULL BACKFILL COMPLETE!\n");
  console.log(`   Total Batches:  ${batchNumber}`);
  console.log(`   Total Processed: ${grandTotalProcessed} tickers`);
  console.log(`   Total Inserted:  ${grandTotalInserted} TTM rows`);
  console.log(`   Total Skipped:   ${grandTotalSkipped} rows`);
  console.log(`   Total Errors:    ${grandTotalErrors} tickers`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
