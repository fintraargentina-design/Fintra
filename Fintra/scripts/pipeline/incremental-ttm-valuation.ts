/**
 * Incremental TTM Valuation Cron Job
 *
 * PURPOSE:
 * Detects newly closed fiscal quarters and creates ONE new TTM row per ticker
 *
 * ARCHITECTURE:
 * - Thin orchestration layer that delegates TTM computation to lib/engine/ttm.ts
 * - Ensures identical results to backfill script (single source of truth)
 * - Runs daily to detect new quarter-end dates
 * - Idempotent: checks if (ticker, valuation_date) already exists before inserting
 *
 * STRICT RULES:
 * - Computes exactly ONE new TTM row per quarter
 * - Does NOT touch existing rows
 * - Uses canonical TTM v2 engine from lib/engine/ttm.ts
 * - EPS computed as net_income_ttm / shares_outstanding (NOT sum of quarterly EPS)
 * - If ANY quarter has NULL for a metric → TTM metric is NULL
 * - Net debt computed from most recent quarter in the window
 * - No custom TTM logic allowed (all logic in lib/engine/ttm.ts)
 *
 * USAGE:
 * pnpm tsx scripts/pipeline/incremental-ttm-valuation.ts
 */

import { loadEnv } from "../utils/load-env";
import { computeTTMv2, type QuarterTTMInput } from "@/lib/engine/ttm";

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
    .from("fintra_universe")
    .select("ticker")
    .eq("is_active", true)
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

  if (error || !data) return null;

  return data.period_end_date;
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

  if (error || !data) return null;

  return data.valuation_date;
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
 * Ensures incremental and backfill produce identical results
 */
function computeTTMMetrics(quarters: QuarterData[]): TTMMetrics {
  // Delegate to canonical TTM v2 engine
  return computeTTMv2(quarters as QuarterTTMInput[]);
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

  // 4. Check if TTM row already exists (idempotency)
  const exists = await ttmRowExists(ticker, latestQuarterDate);
  if (exists) {
    console.log(`   ⏭️  TTM already exists for ${latestQuarterDate}`);
    return false;
  }

  // 5. Get last 4 quarters
  const last4 = await getLastFourQuarters(ticker, latestQuarterDate);

  if (last4.length < 4) {
    console.log(`   ⚠️  Insufficient quarters (${last4.length}/4)`);
    return false;
  }

  // 6. Compute TTM metrics
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

  // 7. Get nearest price (REQUIRED - skip if missing)
  const priceData = await getNearestPrice(ticker, latestQuarterDate);
  if (!priceData) {
    console.log(`   ⚠️  No price data`);
    return false;
  }

  // 8. Compute valuation metrics
  // Note: Individual ratios will be NULL if inputs are missing
  const valuationMetrics = computeValuationMetrics(
    ttmMetrics,
    priceData,
    shares_outstanding,
  );

  // 9. Insert new TTM row
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const { error: insertError } = await supabaseAdmin
    .from("datos_valuacion_ttm")
    .insert({
      ticker,
      valuation_date: latestQuarterDate,
      price: valuationMetrics.price,
      price_date: valuationMetrics.price_date,
      revenue_ttm: ttmMetrics.revenue_ttm,
      ebitda_ttm: ttmMetrics.ebitda_ttm,
      net_income_ttm: ttmMetrics.net_income_ttm,
      eps_ttm: ttmMetrics.eps_ttm,
      free_cash_flow_ttm: ttmMetrics.free_cash_flow_ttm,
      market_cap: valuationMetrics.market_cap,
      enterprise_value: valuationMetrics.enterprise_value,
      net_debt: ttmMetrics.net_debt,
      pe_ratio: valuationMetrics.pe_ratio,
      ev_ebitda: valuationMetrics.ev_ebitda,
      price_to_sales: valuationMetrics.price_to_sales,
      price_to_fcf: valuationMetrics.price_to_fcf,
      quarters_used: last4.map((q) => q.period_label).join(","),
    });

  if (insertError) {
    console.error(`   ❌ Error inserting TTM:`, insertError.message);
    return false;
  }

  console.log(
    `   ✅ TTM created (PE: ${valuationMetrics.pe_ratio?.toFixed(2) || "N/A"}, Price: $${priceData.price.toFixed(2)})`,
  );
  return true;
}

async function main() {
  console.log("🔄 Starting Incremental TTM Valuation Cron...\n");
  console.log("═══════════════════════════════════════════════════════════");

  const tickers = await getActiveTickers();
  console.log(`📋 Processing ${tickers.length} active tickers\n`);

  let newTTMsCreated = 0;
  let processed = 0;

  for (const ticker of tickers) {
    try {
      console.log(`\n[${processed + 1}/${tickers.length}] ${ticker}`);

      const created = await processNewTTMForTicker(ticker);
      if (created) {
        newTTMsCreated++;
      }

      processed++;

      if (processed % 50 === 0) {
        console.log(
          `\n📈 Progress: ${processed}/${tickers.length} tickers processed, ${newTTMsCreated} new TTM rows created\n`,
        );
      }
    } catch (error) {
      console.error(`❌ Error processing ${ticker}:`, error);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("✨ Incremental TTM Cron Complete!");
  console.log(`   Processed: ${processed} tickers`);
  console.log(`   New TTM rows: ${newTTMsCreated}`);
  console.log("═══════════════════════════════════════════════════════════\n");
}

// For direct execution
if (require.main === module) {
  main().catch(console.error);
}

// For Next.js API route
export { main as incrementalTTMValuation };
