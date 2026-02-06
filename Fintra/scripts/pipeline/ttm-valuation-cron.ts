/**
 * CRON: TTM Valuation Incremental Update
 *
 * PURPOSE:
 * Detect newly closed fiscal quarters and compute TTM valuation for them
 *
 * ARCHITECTURE:
 * - Runs daily (after financials-bulk cron)
 * - For each ticker, checks if new quarter exists vs. latest TTM
 * - Creates EXACTLY ONE new TTM row per new quarter
 * - NEVER modifies existing rows
 *
 * DATA RULES (STRICTLY ENFORCED):
 * - TTM requires EXACTLY 4 closed quarters
 * - If ANY quarter has NULL for a metric → TTM metric is NULL (do NOT treat as 0)
 * - valuation_date = quarter_end_date of most recent quarter
 * - price = nearest closing price <= valuation_date
 * - EPS computed as: net_income_ttm / shares_outstanding (NOT sum of quarterly EPS)
 * - Idempotent: safe to run multiple times
 * - No-op if no new quarters detected
 * - Insert row if 4 quarters + price exist (ratios can be NULL independently)
 *
 * EXECUTION:
 * - Direct: pnpm tsx scripts/pipeline/ttm-valuation-cron.ts
 * - Schedule: Daily after financials-bulk (e.g., 4:00 AM)
 */

import { loadEnv } from "../utils/load-env";

loadEnv();

interface QuarterData {
  period_end_date: string;
  period_label: string;
  revenue: number | null;
  ebitda: number | null;
  net_income: number | null;
  eps: number | null;
  free_cash_flow: number | null;
  shares_outstanding: number | null;
  total_debt: number | null;
  cash_and_equivalents: number | null;
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

async function getActiveTickers(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("fintra_active_stocks")
    .select("ticker")
    .order("ticker", { ascending: true });

  if (error) {
    console.error("❌ Error fetching tickers:", error.message);
    return [];
  }

  return data?.map((d) => d.ticker) || [];
}

async function getLatestQuarterEndDate(ticker: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("datos_financieros")
    .select("period_end_date")
    .eq("ticker", ticker)
    .eq("period_type", "Q")
    .order("period_end_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data?.period_end_date || null;
}

async function getLatestTTMDate(ticker: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("datos_valuacion_ttm")
    .select("valuation_date")
    .eq("ticker", ticker)
    .order("valuation_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data?.valuation_date || null;
}

async function getLastFourQuarters(
  ticker: string,
  asOfDate: string,
): Promise<QuarterData[]> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("datos_financieros")
    .select(
      "period_end_date, period_label, revenue, ebitda, net_income, eps, free_cash_flow, shares_outstanding, total_debt, cash_and_equivalents",
    )
    .eq("ticker", ticker)
    .eq("period_type", "Q")
    .lte("period_end_date", asOfDate)
    .order("period_end_date", { ascending: false })
    .limit(4);

  if (error) {
    console.error(`   ❌ Error fetching quarters:`, error.message);
    return [];
  }

  // Reverse to chronological order
  const quarters = (data || []).reverse();

  // Explicitly sort by period_end_date to ensure chronological order
  quarters.sort((a, b) => a.period_end_date.localeCompare(b.period_end_date));

  return quarters;
}

async function getNearestPrice(
  ticker: string,
  targetDate: string,
): Promise<{ price: number; price_date: string } | null> {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");

  const { data, error } = await supabaseAdmin
    .from("datos_eod")
    .select("price_date, close")
    .eq("ticker", ticker)
    .lte("price_date", targetDate)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return { price: data.close, price_date: data.price_date };
}

function computeTTMMetrics(quarters: QuarterData[]): TTMMetrics {
  if (quarters.length !== 4) {
    throw new Error("computeTTMMetrics requires exactly 4 quarters");
  }

  // STRICT RULE: If ANY quarter has NULL for a metric, the TTM metric is NULL
  // Do NOT treat NULL as zero

  // Check revenue
  let revenue_ttm: number | null = null;
  if (quarters.every((q) => q.revenue != null)) {
    revenue_ttm = quarters.reduce((sum, q) => sum + q.revenue!, 0);
  }

  // Check EBITDA
  let ebitda_ttm: number | null = null;
  if (quarters.every((q) => q.ebitda != null)) {
    ebitda_ttm = quarters.reduce((sum, q) => sum + q.ebitda!, 0);
  }

  // Check net income
  let net_income_ttm: number | null = null;
  if (quarters.every((q) => q.net_income != null)) {
    net_income_ttm = quarters.reduce((sum, q) => sum + q.net_income!, 0);
  }

  // Check free cash flow
  let free_cash_flow_ttm: number | null = null;
  if (quarters.every((q) => q.free_cash_flow != null)) {
    free_cash_flow_ttm = quarters.reduce(
      (sum, q) => sum + q.free_cash_flow!,
      0,
    );
  }

  // Use most recent quarter's snapshot values
  const mostRecent = quarters[3];
  const shares_outstanding = mostRecent.shares_outstanding;

  // EPS: Compute as net_income_ttm / shares_outstanding (NOT sum of quarterly EPS)
  let eps_ttm: number | null = null;
  if (
    net_income_ttm != null &&
    shares_outstanding != null &&
    shares_outstanding > 0
  ) {
    eps_ttm = net_income_ttm / shares_outstanding;
  }

  // Net debt calculation
  let net_debt: number | null = null;
  if (
    mostRecent.total_debt != null &&
    mostRecent.cash_and_equivalents != null
  ) {
    net_debt = mostRecent.total_debt - mostRecent.cash_and_equivalents;
  }

  return {
    revenue_ttm,
    ebitda_ttm,
    net_income_ttm,
    eps_ttm,
    free_cash_flow_ttm,
    net_debt,
  };
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
    price_date: valuation.price_date,
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
    quarters_used: quartersUsed.join(","),
  });

  if (error) {
    console.error(`   ❌ Error inserting TTM:`, error.message);
    return false;
  }

  return true;
}

async function processNewTTMForTicker(ticker: string): Promise<boolean> {
  // 1. Get latest quarter end date from financials
  const latestQuarterDate = await getLatestQuarterEndDate(ticker);
  if (!latestQuarterDate) {
    return false; // No quarters available
  }

  // 2. Get latest TTM date
  const latestTTMDate = await getLatestTTMDate(ticker);

  // 3. Check if new quarter exists
  if (latestTTMDate && latestQuarterDate <= latestTTMDate) {
    return false; // No new quarter to process
  }

  console.log(
    `   📊 New quarter: ${latestQuarterDate} (prev TTM: ${latestTTMDate || "none"})`,
  );

  // 4. Get last 4 quarters
  const last4 = await getLastFourQuarters(ticker, latestQuarterDate);

  if (last4.length < 4) {
    console.log(`   ⚠️  Insufficient quarters (${last4.length}/4)`);
    return false;
  }

  // 5. Compute TTM metrics
  let ttmMetrics: TTMMetrics;
  let shares_outstanding: number | null;
  try {
    ttmMetrics = computeTTMMetrics(last4);

    // Validate shares_outstanding: use only if positive
    const rawShares = last4[3].shares_outstanding;
    shares_outstanding = rawShares != null && rawShares > 0 ? rawShares : null;
  } catch (error) {
    console.log(
      `   ⚠️  ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return false;
  }

  // 6. Get nearest price (REQUIRED - skip if missing)
  const priceData = await getNearestPrice(ticker, latestQuarterDate);
  if (!priceData) {
    console.log(`   ⚠️  No price data`);
    return false;
  }

  // 7. Compute valuation metrics
  // Note: Individual ratios will be NULL if inputs are missing
  const valuationMetrics = computeValuationMetrics(
    ttmMetrics,
    priceData,
    shares_outstanding,
  );

  // 8. Insert new TTM row
  const quartersUsed = last4.map((q) => q.period_label);
  const success = await insertTTMRow(
    ticker,
    latestQuarterDate,
    ttmMetrics,
    valuationMetrics,
    quartersUsed,
  );

  if (success) {
    console.log(
      `   ✅ TTM created (PE: ${valuationMetrics.pe_ratio?.toFixed(2) || "N/A"}, Price: $${priceData.price.toFixed(2)})`,
    );
  }

  return success;
}

async function runTTMValuationCron() {
  console.log("🔄 TTM Valuation Cron - Incremental Update");
  console.log("═══════════════════════════════════════════════════════════");

  const tickers = await getActiveTickers();
  console.log(`📋 Processing ${tickers.length} active tickers\n`);

  let newTTMsCreated = 0;
  let processed = 0;
  let errors = 0;

  for (const ticker of tickers) {
    try {
      const created = await processNewTTMForTicker(ticker);

      if (created) {
        console.log(`[${processed + 1}/${tickers.length}] ${ticker}`);
        newTTMsCreated++;
      }

      processed++;

      // Progress update every 100 tickers
      if (processed % 100 === 0) {
        console.log(
          `\n📈 Progress: ${processed}/${tickers.length} | ${newTTMsCreated} new TTMs\n`,
        );
      }
    } catch (error) {
      console.error(`\n[${processed + 1}/${tickers.length}] ${ticker}`);
      console.error(
        `   ❌ Fatal error:`,
        error instanceof Error ? error.message : "Unknown error",
      );
      errors++;
      processed++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("✨ TTM Valuation Cron Complete!\n");
  console.log(`   Processed:   ${processed} tickers`);
  console.log(`   New TTMs:    ${newTTMsCreated}`);
  console.log(`   Errors:      ${errors}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

// For direct execution
if (require.main === module) {
  runTTMValuationCron().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

// Export for API route
export { runTTMValuationCron };
