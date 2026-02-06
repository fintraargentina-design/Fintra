import { supabaseAdmin } from "@/lib/supabase-admin";
import { getActiveStockTickers } from "@/lib/repository/active-stocks";
import { upsertDatosFinancieros } from "../fmp-bulk/upsertDatosFinancieros";
import { deriveFinancialMetrics } from "./deriveFinancialMetrics";
import Papa from "papaparse";
import fs from "fs/promises";
import { createReadStream, existsSync } from "fs";
import path from "path";

// Verbose logging control
let VERBOSE = false;
const debugLog = (...args: any[]) => {
  if (VERBOSE) console.log(...args);
};

// Helper to resolve data directory correctly (handling scripts execution context)
const resolveDataDir = (subDir: string) => {
  let root = process.cwd();
  if (root.includes("scripts")) {
    // Traverse up to find package.json or stop at root
    let current = root;
    while (current !== path.dirname(current)) {
      if (existsSync(path.join(current, "package.json"))) {
        root = current;
        break;
      }
      current = path.dirname(current);
    }
  }
  return path.join(root, "data", subDir);
};

// --- Type Definitions (Internal Type Safety) ---
// These interfaces prevent accidental cross-use of FY/Q/TTM fields
interface FYStatementInput {
  date: string;
  period: "FY";
  calendarYear?: string;
  [key: string]: any; // Financial fields
}

interface QuarterlyStatementInput {
  date: string;
  period: "Q1" | "Q2" | "Q3" | "Q4";
  calendarYear?: string;
  [key: string]: any; // Financial fields
}

interface TTMStatementInput {
  date?: string; // Computed from latest quarter
  [key: string]: any; // Aggregated financial fields
}

interface TTMBulkInput {
  symbol?: string;
  ticker?: string;
  [key: string]: any; // TTM-specific metrics
}

// --- Constants & Config ---
const BASE_URL = "https://financialmodelingprep.com/stable";
const CACHE_DIR = resolveDataDir("fmp-bulk");

const ENDPOINT_MAP: Record<string, string> = {
  "income-statement-bulk": "income",
  "balance-sheet-statement-bulk": "balance",
  "cash-flow-statement-bulk": "cashflow",
  "key-metrics-ttm-bulk": "metrics_ttm",
  "ratios-ttm-bulk": "ratios_ttm",
};

// Year Range Configuration
// START_YEAR: 2015 - Historical data before 2015 is excluded to optimize performance
// and focus on recent financial data (10-year historical window for CAGR calculations)
const START_YEAR = 2015;
const END_YEAR = new Date().getFullYear() + 1;
const YEARS = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_, i) => START_YEAR + i,
);

// CRITICAL: Default years for daily cron (only mutable periods)
// This prevents processing 2015-2024 every day (those are immutable)
// Historical data is gap-filled automatically when new tickers are added
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth(); // 0 = Jan, 2 = March
const MUTABLE_YEARS =
  currentMonth <= 2
    ? [currentYear - 1, currentYear, currentYear + 1] // Before March: include previous year
    : [currentYear, currentYear + 1]; // After March: only current + next

const PERIODS = ["FY", "Q1", "Q2", "Q3", "Q4"];

// --- Helper Functions ---

// Helper to group by ticker
const groupByTicker = (rows: any[]) => {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const symbol = row.symbol || row.ticker;
    if (!symbol) continue;
    if (!map.has(symbol)) map.set(symbol, []);
    map.get(symbol)!.push(row);
  }
  return map;
};

// Task 5: Non-blocking preflight integrity checks (for observability)
const runPreflightChecks = (
  ticker: string,
  income: any[],
  balance: any[],
  cashflow: any[],
): void => {
  // Check for duplicate periods
  const periodKeys = new Set<string>();
  [...income, ...balance, ...cashflow].forEach((row) => {
    const key = `${row.period}-${row.date}`;
    if (periodKeys.has(key)) {
      console.warn(`[preflight:${ticker}] DUPLICATE period detected: ${key}`);
    }
    periodKeys.add(key);
  });

  // Check for mismatched dates between statements (same period)
  const periods = new Set(
    [...income, ...balance, ...cashflow].map((r) => r.period),
  );
  periods.forEach((period) => {
    const incDates = income
      .filter((r) => r.period === period)
      .map((r) => r.date);
    const balDates = balance
      .filter((r) => r.period === period)
      .map((r) => r.date);
    const cfDates = cashflow
      .filter((r) => r.period === period)
      .map((r) => r.date);

    const allDates = new Set([...incDates, ...balDates, ...cfDates]);
    if (allDates.size > 1) {
      console.warn(
        `[preflight:${ticker}] DATE MISMATCH for period ${period}: ${Array.from(allDates).join(", ")}`,
      );
    }
  });

  // Check for missing statements (income exists but balance/cashflow missing)
  income.forEach((inc) => {
    const hasBalance = balance.some(
      (b) => b.period === inc.period && b.date === inc.date,
    );
    const hasCashflow = cashflow.some(
      (cf) => cf.period === inc.period && cf.date === inc.date,
    );
    if (!hasBalance || !hasCashflow) {
      console.warn(
        `[preflight:${ticker}] INCOMPLETE statements for ${inc.period} ${inc.date} (balance=${hasBalance}, cashflow=${hasCashflow})`,
      );
    }
  });
};

// Helper to sum quarterly statements for TTM
function sumStatements(rows: any[]) {
  const sum: any = {};
  if (!rows.length) return sum;

  // Initialize with keys from first row (latest)
  Object.keys(rows[0]).forEach((k) => {
    if (typeof rows[0][k] === "number") sum[k] = 0;
    else sum[k] = rows[0][k]; // Keep text/date from first (latest)
  });

  for (const row of rows) {
    Object.keys(row).forEach((k) => {
      if (typeof row[k] === "number") {
        sum[k] = (sum[k] || 0) + row[k];
      }
    });
  }
  return sum;
}

/**
 * PERSISTENCE DTO: Explicit contract for datos_financieros
 *
 * This function defines EXACTLY which fields from deriveFinancialMetrics
 * are persisted to datos_financieros table.
 *
 * RULES:
 * - Only period-level facts and ratios (state of THIS period)
 * - NO longitudinal metrics (CAGR, growth across periods)
 * - NO helper/intermediate values not in schema
 * - Explicit mapping = auditable contract
 */
function buildPersistableMetrics(derived: any) {
  return {
    // Period-level inputs (raw values)
    revenue: derived.revenue,
    net_income: derived.net_income,
    total_equity: derived.total_equity,
    total_debt: derived.total_debt,
    free_cash_flow: derived.free_cash_flow,
    invested_capital: derived.invested_capital,
    weighted_shares_out: derived.weighted_shares_out,
    cash_and_equivalents: derived.cash_and_equivalents,
    ebitda: derived.ebitda,

    // Period-level ratios (derived from THIS period only)
    operating_margin: derived.operating_margin,
    net_margin: derived.net_margin,
    fcf_margin: derived.fcf_margin,
    roic: derived.roic,
    debt_to_equity: derived.debt_to_equity,
    interest_coverage: derived.interest_coverage,
    gross_margin: derived.gross_margin,
    roe: derived.roe,
    current_ratio: derived.current_ratio,
    book_value_per_share: derived.book_value_per_share,
    ebitda_margin: derived.ebitda_margin,
    wacc: derived.wacc,
    data_completeness: derived.data_completeness,
    data_freshness: derived.data_freshness,

    // Longitudinal metrics (multi-period analytics)
    // These ARE persisted because they represent trailing growth up to this period
    revenue_cagr: derived.revenue_cagr,
    earnings_cagr: derived.earnings_cagr,
    equity_cagr: derived.equity_cagr,
    // Note: fcf_cagr excluded - not a column in datos_financieros
  };
}

// Helper to check if two quarters are consecutive
// qNew should be immediately after qOld
function areConsecutive(qNew: any, qOld: any): boolean {
  if (!qNew || !qOld) return false;

  // 1. Try strict Calendar Year + Period check
  if (qNew.calendarYear && qOld.calendarYear && qNew.period && qOld.period) {
    const yNew = parseInt(qNew.calendarYear);
    const yOld = parseInt(qOld.calendarYear);
    const pNew = qNew.period; // e.g. "Q1"
    const pOld = qOld.period;

    // Same year: Q2 after Q1, etc.
    if (yNew === yOld) {
      if (pNew === "Q2" && pOld === "Q1") return true;
      if (pNew === "Q3" && pOld === "Q2") return true;
      if (pNew === "Q4" && pOld === "Q3") return true;
    }
    // Year crossing: Q1 of Next Year after Q4 of Prev Year
    if (yNew === yOld + 1) {
      if (pNew === "Q1" && pOld === "Q4") return true;
    }

    // If strict check fails but data exists, do NOT fallback immediately?
    // FMP sometimes has weird periods. Let's use Date as secondary confirmation or fallback.
  }

  // 2. Fallback: Date Check (approx 3 months)
  // Q ends are usually ~90 days apart. Allow 75-105 days.
  const dNew = new Date(qNew.date).getTime();
  const dOld = new Date(qOld.date).getTime();
  const diffDays = (dNew - dOld) / (1000 * 3600 * 24);

  return diffDays >= 75 && diffDays <= 105;
}

// Helper to check if a period is mutable (should be re-processed)
function isMutablePeriod(year: number | null, period: string | null): boolean {
  // 1. Always process TTM (year/period are null for TTM bulk files)
  if (year === null || period === null) return true;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 = Jan, 2 = March

  // 2. Always process current calendar year (Qs and FY)
  if (year === currentYear) return true;

  // 3. Process previous year
  if (year === currentYear - 1) {
    // Before March 31: Previous year is considered open/mutable (Q4 results coming in, FY finalizing)
    if (currentMonth <= 2) return true;

    // After March 31: Previous year is closed/immutable
    return false;
  }

  // 4. Skip older years
  return false;
}

// Helper to find missing tickers in DB for a specific period
async function getMissingTickersForPeriod(
  tickers: Set<string>,
  year: number,
  period: string,
  type: "Q" | "FY",
): Promise<Set<string>> {
  if (tickers.size === 0) return new Set();

  const tickerList = Array.from(tickers);
  const periodLabel = type === "FY" ? `${year}` : `${year}${period}`;
  const existingTickers = new Set<string>();

  // Batch processing to avoid 414 URI Too Large
  const BATCH_SIZE = 1000;
  for (let i = 0; i < tickerList.length; i += BATCH_SIZE) {
    const batch = tickerList.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabaseAdmin
      .from("datos_financieros")
      .select("ticker")
      .eq("period_type", type)
      .eq("period_label", periodLabel)
      .in("ticker", batch);

    if (error) {
      console.error(
        `[financials-bulk] Error checking missing tickers for ${periodLabel} (batch ${i}):`,
        error,
      );
      // Continue to next batch, effectively treating failed batch as "missing" (re-process safe)
      continue;
    }

    if (data) {
      data.forEach((r) => existingTickers.add(r.ticker));
    }
  }

  // Return only those NOT in existingTickers
  const missing = new Set<string>();
  for (const t of tickerList) {
    if (!existingTickers.has(t)) {
      missing.add(t);
    }
  }
  return missing;
}

// NEW: Batch gap detection - fetch ALL existing periods for all tickers in ONE query
async function getAllExistingPeriods(
  tickers: Set<string>,
): Promise<Map<string, Set<string>>> {
  if (tickers.size === 0) return new Map();

  const tickerList = Array.from(tickers);
  const tickerPeriodsMap = new Map<string, Set<string>>();

  // Initialize map
  for (const ticker of tickerList) {
    tickerPeriodsMap.set(ticker, new Set());
  }

  // Batch processing to avoid URI limits
  const BATCH_SIZE = 1000;
  for (let i = 0; i < tickerList.length; i += BATCH_SIZE) {
    const batch = tickerList.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabaseAdmin
      .from("datos_financieros")
      .select("ticker, period_type, period_label")
      .in("ticker", batch);

    if (error) {
      console.error(
        `[financials-bulk] Error fetching existing periods:`,
        error,
      );
      continue;
    }

    if (data) {
      data.forEach((row) => {
        const key = `${row.period_type}:${row.period_label}`;
        tickerPeriodsMap.get(row.ticker)?.add(key);
      });
    }
  }

  return tickerPeriodsMap;
}

// Helper to check if period exists using pre-fetched map
function hasPeriod(
  tickerPeriodsMap: Map<string, Set<string>>,
  ticker: string,
  year: number,
  period: string,
  type: "Q" | "FY",
): boolean {
  const periodLabel = type === "FY" ? `${year}` : `${year}${period}`;
  const key = `${type}:${periodLabel}`;
  return tickerPeriodsMap.get(ticker)?.has(key) || false;
}

// --- Refactored Phase Functions ---

async function downloadAndCacheCSVs(apiKey: string, yearsOverride?: number[]) {
  console.log(`[financials-bulk] Starting Download Phase...`);
  // CRITICAL: Use MUTABLE_YEARS by default (not YEARS)
  const targetYears = yearsOverride || MUTABLE_YEARS;

  console.log(`[financials-bulk] Downloading years: ${targetYears.join(", ")}`);

  // Ensure cache directory exists
  if (!existsSync(CACHE_DIR)) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }

  const fetchFile = async (
    endpointBase: string,
    year: number | null,
    period: string | null,
  ) => {
    const prefix = ENDPOINT_MAP[endpointBase] || endpointBase;
    const fileName = year ? `${prefix}_${year}_${period}.csv` : `${prefix}.csv`;
    const filePath = path.join(CACHE_DIR, fileName);

    let url = `${BASE_URL}/${endpointBase}?apikey=${apiKey}`;
    if (year && period) {
      url += `&year=${year}&period=${period}`;
    }

    if (!existsSync(filePath) || isMutablePeriod(year, period)) {
      const action = existsSync(filePath) ? "REFRESH" : "MISS";
      debugLog(`[fmp-bulk-cache] ${action} ${fileName} -> downloading`);
      try {
        const res = await fetch(url);

        if (res.status === 429) {
          console.error(
            `[fmp-bulk-cache] FETCH FAILED ${fileName} (429) - Rate Limit Exceeded`,
          );
          return;
        }

        if (!res.ok) {
          console.warn(
            `[fmp-bulk-cache] Failed to fetch ${url}: ${res.status} ${res.statusText}`,
          );
          return;
        }

        const arrayBuffer = await res.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(arrayBuffer));
      } catch (e) {
        console.error(`[fmp-bulk-cache] Error fetching ${url}:`, e);
      }
    } else {
      debugLog(`[fmp-bulk-cache] HIT ${fileName} (Immutable & Cached)`);
    }
  };

  const tasks: Promise<void>[] = [];

  // Queue up downloads
  for (const year of targetYears) {
    for (const period of PERIODS) {
      tasks.push(fetchFile("income-statement-bulk", year, period));
      tasks.push(fetchFile("balance-sheet-statement-bulk", year, period));
      tasks.push(fetchFile("cash-flow-statement-bulk", year, period));
    }
  }

  // TTM Bulk
  // TEMP: Skip TTM downloads/parsing due to timeout issues
  // TODO: Investigate TTM parsing performance issue
  // tasks.push(fetchFile("key-metrics-ttm-bulk", null, null));
  // tasks.push(fetchFile("ratios-ttm-bulk", null, null));

  // Execute in chunks with delay and retry
  const CHUNK_SIZE = 5; // Reduced from 10 to be safer
  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk);
    // Add delay to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("[financials-bulk] Download phase completed");
}

async function parseCachedCSVs(
  activeTickers: Set<string>,
  yearsOverride?: number[],
  forceUpdate: boolean = false,
) {
  console.log(`[financials-bulk] Starting Parse Phase...`);
  // CRITICAL: Use MUTABLE_YEARS by default (not YEARS)
  // This makes daily cron run 10x faster by only processing recent data
  const targetYears = yearsOverride || MUTABLE_YEARS;

  console.log(`[financials-bulk] Target years: ${targetYears.join(", ")}`);
  console.log(
    `[financials-bulk] Mode: ${yearsOverride ? "FULL (all years)" : "DAILY (mutable years only)"}`,
  );

  // Track parsing stats
  const parseStats = {
    totalFiles: 0,
    skipped: 0,
    gapFilled: 0,
    mutableProcessed: 0,
  };

  // CRITICAL OPTIMIZATION: Fetch ALL existing periods for ALL tickers in ONE query
  // This replaces ~195 individual queries with 1 batch query
  console.log(
    `[financials-bulk] 🔍 Pre-fetching existing periods for ${activeTickers.size} tickers...`,
  );
  const tickerPeriodsMap = forceUpdate
    ? new Map() // Skip pre-fetch if forceUpdate (will reprocess everything)
    : await getAllExistingPeriods(activeTickers);
  console.log(
    `[financials-bulk] ✅ Loaded existing data for ${tickerPeriodsMap.size} tickers`,
  );

  const parseFile = async (
    endpointBase: string,
    year: number | null,
    period: string | null,
  ): Promise<any[]> => {
    const prefix = ENDPOINT_MAP[endpointBase] || endpointBase;
    const fileName = year ? `${prefix}_${year}_${period}.csv` : `${prefix}.csv`;

    let targetTickers = activeTickers;
    const isMutable = isMutablePeriod(year, period);

    parseStats.totalFiles++;

    // GAP DETECTION LOGIC (Skip if forceUpdate is true)
    if (!forceUpdate && !isMutable && year !== null && period !== null) {
      const type = period === "FY" ? "FY" : "Q";

      // NEW: Use pre-fetched map instead of querying DB
      const missing = new Set<string>();
      for (const ticker of activeTickers) {
        if (!hasPeriod(tickerPeriodsMap, ticker, year, period, type)) {
          missing.add(ticker);
        }
      }

      if (missing.size === 0) {
        // All tickers in this batch already have this immutable period
        debugLog(
          `[fmp-bulk-cache] ⏩ SKIP ${fileName} (All ${activeTickers.size} tickers already have data)`,
        );
        parseStats.skipped++;
        return [];
      }

      // Only process the rows for the missing tickers
      debugLog(
        `[fmp-bulk-cache] 📊 GAP-FILL ${fileName} -> ${missing.size}/${activeTickers.size} tickers missing (${activeTickers.size - missing.size} already cached)`,
      );
      parseStats.gapFilled++;
      targetTickers = missing;
    } else if (isMutable) {
      debugLog(
        `[fmp-bulk-cache] 🔄 PROCESS ${fileName} (Mutable period - year: ${year})`,
      );
      parseStats.mutableProcessed++;
    }
    // If mutable OR forceUpdate=true, targetTickers remains activeTickers (process all)

    if (activeTickers.size === 1) {
      debugLog(
        `[DEBUG ${fileName}] targetTickers: ${targetTickers.size}, looking for: "${Array.from(activeTickers)[0]}"`,
      );
    }

    const filePath = path.join(CACHE_DIR, fileName);

    if (!existsSync(filePath)) {
      console.warn(`[fmp-bulk-cache] File not found: ${fileName} (skipping)`);
      return [];
    }

    return new Promise((resolve) => {
      const rows: any[] = [];
      const stream = createReadStream(filePath);
      const foundTickers = new Set<string>(); // Track which tickers we've found

      Papa.parse(stream, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        quoteChar: '"', // Explicitly tell Papa to handle quotes
        escapeChar: '"',
        transformHeader: (header: string) => {
          // Remove quotes from header names (FMP CSVs have "columnName" format)
          return header.replace(/^"|"$/g, "");
        },
        step: (results: any, parser: any) => {
          const row = results.data;
          // Remove ALL quotes from symbol field (FMP CSVs have "VALUE" format)
          let symbol = row.symbol || row.ticker;
          const originalSymbol = symbol;
          if (symbol && typeof symbol === "string") {
            symbol = symbol.replace(/"/g, ""); // Remove ALL quotes, not just start/end
          }

          // Filter: Must be in our target list (either full batch or missing subset)
          if (symbol && targetTickers.has(symbol)) {
            rows.push(row);
            foundTickers.add(symbol);

            // Early termination: If we found all target tickers, stop parsing
            if (foundTickers.size === targetTickers.size) {
              parser.abort(); // Stop parsing the rest of the CSV
            }
          }
        },
        complete: () => {
          resolve(rows);
        },
        error: (err: any) => {
          console.error(`[fmp-bulk-cache] Error parsing ${fileName}:`, err);
          resolve([]);
        },
      });
    });
  };

  const tasks: Promise<{ type: string; rows: any[] }>[] = [];

  for (const year of targetYears) {
    for (const period of PERIODS) {
      tasks.push(
        parseFile("income-statement-bulk", year, period).then((rows) => ({
          type: "income",
          rows,
        })),
      );
      tasks.push(
        parseFile("balance-sheet-statement-bulk", year, period).then(
          (rows) => ({ type: "balance", rows }),
        ),
      );
      tasks.push(
        parseFile("cash-flow-statement-bulk", year, period).then((rows) => ({
          type: "cashflow",
          rows,
        })),
      );
    }
  }

  // TEMP: Skip TTM parsing due to timeout issues
  // tasks.push(
  //   parseFile("key-metrics-ttm-bulk", null, null).then((rows) => ({
  //     type: "metrics_ttm",
  //     rows,
  //   })),
  // );
  // tasks.push(
  //   parseFile("ratios-ttm-bulk", null, null).then((rows) => ({
  //     type: "ratios_ttm",
  //     rows,
  //   })),
  // );

  debugLog(`[financials-bulk] Parsing ${tasks.length} tasks...`);

  const CHUNK_SIZE = 10;
  const results: { type: string; rows: any[] }[] = [];

  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk);
    results.push(...chunkResults);
  }

  // Print optimization summary
  console.log(`\n📈 PARSE PHASE SUMMARY:`);
  console.log(`   Total files checked: ${parseStats.totalFiles}`);
  console.log(
    `   ⏩ Skipped (already cached): ${parseStats.skipped} (${Math.round((parseStats.skipped / parseStats.totalFiles) * 100)}%)`,
  );
  console.log(
    `   📊 Gap-filled (partial data): ${parseStats.gapFilled} (${Math.round((parseStats.gapFilled / parseStats.totalFiles) * 100)}%)`,
  );
  console.log(
    `   🔄 Processed (mutable/new): ${parseStats.mutableProcessed} (${Math.round((parseStats.mutableProcessed / parseStats.totalFiles) * 100)}%)`,
  );
  console.log(
    `   💾 Cache Hit Rate: ${Math.round((parseStats.skipped / parseStats.totalFiles) * 100)}%\n`,
  );

  const income = results
    .filter((r) => r.type === "income")
    .flatMap((r) => r.rows);
  const balance = results
    .filter((r) => r.type === "balance")
    .flatMap((r) => r.rows);
  const cashflow = results
    .filter((r) => r.type === "cashflow")
    .flatMap((r) => r.rows);
  const metricsTTM = results
    .filter((r) => r.type === "metrics_ttm")
    .flatMap((r) => r.rows);
  const ratiosTTM = results
    .filter((r) => r.type === "ratios_ttm")
    .flatMap((r) => r.rows);

  return { income, balance, cashflow, metricsTTM, ratiosTTM };
}

async function persistFinancialsStreaming(
  activeTickers: string[],
  data: {
    income: any[];
    balance: any[];
    cashflow: any[];
    metricsTTM: any[];
    ratiosTTM: any[];
  },
  maxBatchSize: number,
) {
  const { income, balance, cashflow, metricsTTM, ratiosTTM } = data;

  // Index by ticker (local to this chunk)
  const incomeMap = groupByTicker(income);
  const balanceMap = groupByTicker(balance);
  const cashflowMap = groupByTicker(cashflow);
  const metricsTTMMap = groupByTicker(metricsTTM);
  const ratiosTTMMap = groupByTicker(ratiosTTM);

  // CRITICAL OPTIMIZATION: Only process tickers that have parsed data
  // This prevents building metrics for tickers that were skipped due to cache hits
  const tickersWithData = new Set([
    ...incomeMap.keys(),
    ...balanceMap.keys(),
    ...cashflowMap.keys(),
  ]);

  if (tickersWithData.size === 0) {
    console.log(
      `[FinancialsBulk] ✅ No new data to process (all ${activeTickers.length} tickers already cached)`,
    );
    return {
      processed: 0,
      skipped: activeTickers.length,
      fy_built: 0,
      q_built: 0,
      ttm_built: 0,
    };
  }

  console.log(
    `[FinancialsBulk] 🔨 Building metrics for ${tickersWithData.size}/${activeTickers.length} tickers (${activeTickers.length - tickersWithData.size} skipped due to cache)`,
  );

  let rowsBuffer: any[] = [];
  const stats = {
    processed: 0,
    skipped: activeTickers.length - tickersWithData.size, // Count cache hits as skipped
    fy_built: 0,
    q_built: 0,
    ttm_built: 0,
  };

  const sanitizeRow = (row: any) => {
    const sanitized: any = {};
    const stringWhitelist = new Set([
      "ticker",
      "period_type",
      "period_label",
      "period_end_date",
      "source",
    ]);
    for (const key of Object.keys(row)) {
      const value = (row as any)[key];
      if (typeof value === "number") {
        sanitized[key] = Number.isFinite(value) ? value : null;
      } else if (
        typeof value === "string" &&
        !stringWhitelist.has(key) &&
        value.toLowerCase().includes("nan")
      ) {
        sanitized[key] = null;
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  const flushBatch = async () => {
    if (rowsBuffer.length === 0) return;

    // Deduplicate rows based on unique constraints (ticker, period_type, period_label)
    const uniqueRowsMap = new Map();
    rowsBuffer.forEach((row) => {
      const key = `${row.ticker}-${row.period_type}-${row.period_label}`;
      uniqueRowsMap.set(key, row);
    });
    const uniqueRows = Array.from(uniqueRowsMap.values());

    // DTO pattern already ensures only persistable fields are included
    // No need for dynamic exclusion - buildPersistableMetrics defines the contract
    const dbChunk = uniqueRows.map((row) => sanitizeRow(row));

    // Paginate inserts in chunks of 5000 rows to respect Supabase limits (~3 MB per chunk)
    // PARALLEL UPSERTS: Launch all chunks simultaneously to maximize I/O throughput
    const INSERT_CHUNK_SIZE = 5000;
    const chunks: any[][] = [];
    for (let i = 0; i < dbChunk.length; i += INSERT_CHUNK_SIZE) {
      chunks.push(dbChunk.slice(i, i + INSERT_CHUNK_SIZE));
    }

    if (chunks.length > 1) {
      console.log(
        `[FinancialsBulk] Launching ${chunks.length} parallel upserts (${dbChunk.length} total rows)`,
      );
    }

    try {
      // Execute all chunks in parallel with Promise.all()
      await Promise.all(
        chunks.map((insertChunk, idx) =>
          upsertDatosFinancieros(supabaseAdmin, insertChunk).then(() => {
            if (chunks.length > 1) {
              debugLog(
                `[FinancialsBulk] ✓ Chunk ${idx + 1}/${chunks.length} completed (${insertChunk.length} rows)`,
              );
            }
          }),
        ),
      );
    } catch (e) {
      console.error("[FinancialsBulk] Parallel upsert failed:", e);
      // Find which chunk failed by attempting to identify tickers
      const allTickers = Array.from(
        new Set(dbChunk.map((r: any) => r.ticker)),
      ).slice(0, 50);
      console.error("[FinancialsBulk] Batch contained tickers:", allTickers);
      throw e;
    }

    // Clear buffer
    rowsBuffer = [];
  };

  // 3. Process each ticker (ONLY those with parsed data)
  for (const ticker of tickersWithData) {
    const tickerIncome = incomeMap.get(ticker) || [];
    const tickerBalance = balanceMap.get(ticker) || [];
    const tickerCashflow = cashflowMap.get(ticker) || [];
    const tickerMetricsTTM = metricsTTMMap.get(ticker)?.[0] || null; // Usually 1 row per ticker
    const tickerRatiosTTM = ratiosTTMMap.get(ticker)?.[0] || null;

    // Task 5: Run non-blocking preflight integrity checks
    runPreflightChecks(ticker, tickerIncome, tickerBalance, tickerCashflow);

    if (!tickerIncome.length && !tickerBalance.length) {
      stats.skipped++;
      continue;
    }

    stats.processed++;

    // Filter Historical FY rows (for CAGR)
    const historicalIncome = tickerIncome
      .filter((r) => r.period === "FY")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const historicalCashflow = tickerCashflow
      .filter((r) => r.period === "FY")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const historicalBalance = tickerBalance
      .filter((r) => r.period === "FY")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // --- BUILD FY (Annuals) ---
    // We process ALL available FY rows
    const fyIncomes = tickerIncome
      .filter((r) => r.period === "FY")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const inc of fyIncomes) {
      const bal = tickerBalance.find(
        (r) => r.period === "FY" && r.date === inc.date,
      );
      const cf = tickerCashflow.find(
        (r) => r.period === "FY" && r.date === inc.date,
      );

      if (bal && cf) {
        const derived = deriveFinancialMetrics({
          income: inc,
          balance: bal,
          cashflow: cf,
          // Do NOT use TTM metrics for historical FY rows
          metricsTTM: null,
          ratiosTTM: null,
          historicalIncome: historicalIncome, // Pass full history for CAGR
          historicalCashflow: historicalCashflow,
          historicalBalance: historicalBalance,
          periodType: "FY",
          periodEndDate: inc.date,
        });

        // Explicit persistence contract: only period-level metrics
        const persistable = buildPersistableMetrics(derived);

        rowsBuffer.push({
          ticker,
          period_type: "FY",
          period_label: inc.date.slice(0, 4), // Year as label
          period_end_date: inc.date,
          source: "fmp_bulk",
          period_status: "preliminary",
          ...persistable,
        });
        stats.fy_built++;
      }
    }

    // --- BUILD QUARTERS (New Step 1) ---
    const qIncome = tickerIncome
      .filter((r) => r.period !== "FY")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const qBalance = tickerBalance
      .filter((r) => r.period !== "FY")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const qCashflow = tickerCashflow
      .filter((r) => r.period !== "FY")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const inc of qIncome) {
      const bal = qBalance.find((r) => r.date === inc.date);
      const cf = qCashflow.find((r) => r.date === inc.date);

      if (bal && cf) {
        const derived = deriveFinancialMetrics({
          income: inc,
          balance: bal,
          cashflow: cf,
          metricsTTM: null,
          ratiosTTM: null,
          historicalIncome: historicalIncome,
          historicalCashflow: historicalCashflow,
          historicalBalance: historicalBalance,
          periodType: "Q",
          periodEndDate: inc.date,
        });

        // Explicit persistence contract: only period-level metrics
        const persistable = buildPersistableMetrics(derived);

        rowsBuffer.push({
          ticker,
          period_type: "Q",
          period_label: `${inc.calendarYear || inc.date.substring(0, 4)}${inc.period}`,
          period_end_date: inc.date,
          source: "fmp_bulk",
          period_status: "preliminary",
          ...persistable,
        });
        stats.q_built++;
      }
    }

    // --- BUILD TTM (Trailing 12 Months) (Step 2) ---
    // Need last 4 CONSECUTIVE quarters
    let ttmPendingReason: string | null = null;

    if (qIncome.length < 4) {
      ttmPendingReason = "insufficient_quarters";
    } else {
      const q1 = qIncome[0]; // Latest
      const q2 = qIncome[1];
      const q3 = qIncome[2];
      const q4 = qIncome[3];

      if (
        !areConsecutive(q1, q2) ||
        !areConsecutive(q2, q3) ||
        !areConsecutive(q3, q4)
      ) {
        ttmPendingReason = "non_consecutive_quarters";
      }

      if (
        !ttmPendingReason &&
        areConsecutive(q1, q2) &&
        areConsecutive(q2, q3) &&
        areConsecutive(q3, q4)
      ) {
        const last4Income = [q1, q2, q3, q4];
        // Ensure CFs exist for all 4
        const last4Cashflow = last4Income
          .map((inc) => qCashflow.find((cf) => cf.date === inc.date))
          .filter(Boolean);
        const latestBalance = qBalance.find((b) => b.date === q1.date);

        if (last4Cashflow.length < 4) {
          ttmPendingReason = "missing_cashflow_statements";
        } else if (!latestBalance) {
          ttmPendingReason = "missing_balance_sheet";
        }

        if (last4Cashflow.length === 4 && latestBalance) {
          const ttmIncome = sumStatements(last4Income);
          const ttmCashflow = sumStatements(last4Cashflow as any[]);

          // Task 3: TTM label based on period_end_date for global uniqueness
          // Format: TTM_YYYY-MM-DD (e.g., TTM_2023-09-30)
          // This prevents collisions from restatements or fiscal calendar shifts
          const ttmLabel = `TTM_${q1.date}`;

          // CRITICAL: Filter historical arrays to prevent look-ahead bias
          // TTM must only see data up to its period end date (point-in-time calculation)
          const ttmCutoffDate = q1.date;
          const filteredHistoricalIncome = historicalIncome.filter(
            (row) => row.date <= ttmCutoffDate,
          );
          const filteredHistoricalCashflow = historicalCashflow.filter(
            (row) => row.date <= ttmCutoffDate,
          );
          const filteredHistoricalBalance = historicalBalance.filter(
            (row) => row.date <= ttmCutoffDate,
          );

          const derived = deriveFinancialMetrics({
            income: ttmIncome,
            balance: latestBalance,
            cashflow: ttmCashflow,
            metricsTTM: tickerMetricsTTM,
            ratiosTTM: tickerRatiosTTM,
            historicalIncome: filteredHistoricalIncome,
            historicalCashflow: filteredHistoricalCashflow,
            historicalBalance: filteredHistoricalBalance,
            periodType: "TTM",
            periodEndDate: q1.date,
          });

          // Explicit persistence contract: only period-level metrics
          const persistable = buildPersistableMetrics(derived);

          rowsBuffer.push({
            ticker,
            period_type: "TTM",
            period_label: ttmLabel,
            period_end_date: q1.date,
            source: "fmp_bulk",
            period_status: "preliminary",
            ...persistable,
          });
          stats.ttm_built++;
        }
      }
    }

    // Task 1: Explicit TTM Pending State - Record when TTM cannot be constructed
    if (ttmPendingReason && qIncome.length > 0) {
      const latestQ = qIncome[0];
      const ttmPendingLabel = `TTM_${latestQ.date}`;

      rowsBuffer.push({
        ticker,
        period_type: "TTM",
        period_label: ttmPendingLabel,
        period_end_date: latestQ.date,
        source: "fmp_bulk",
        period_status: "preliminary",
        ttm_status: "pending",
        ttm_reason: ttmPendingReason,
        // All financial fields null when pending
        revenue: null,
        net_income: null,
        ebitda: null,
        free_cash_flow: null,
      });
      debugLog(
        `[FinancialsBulk] TTM pending for ${ticker}: ${ttmPendingReason}`,
      );
    }

    // Check buffer size
    if (rowsBuffer.length >= maxBatchSize) {
      debugLog("[FinancialsBulk] Flushing batch", {
        size: rowsBuffer.length,
        sampleTickers: Array.from(
          new Set(rowsBuffer.slice(0, 100).map((r) => r.ticker)),
        ).slice(0, 10),
      });
      await flushBatch();
    }
  }

  debugLog("[FinancialsBulk] Final flush", {
    remaining: rowsBuffer.length,
    sampleTickers: Array.from(
      new Set(rowsBuffer.slice(0, 100).map((r) => r.ticker)),
    ).slice(0, 10),
  });
  await flushBatch();

  return stats;
}

export async function runFinancialsBulk(
  targetTicker?: string,
  limit?: number,
  years?: number[],
  forceUpdate: boolean = false,
  skipDownload: boolean = false,
  batchSize: number = 2000,
  offset: number = 0,
  verbose: boolean = false,
) {
  VERBOSE = verbose;

  const fmpKey = process.env.FMP_API_KEY!;
  if (!fmpKey) {
    throw new Error("Missing FMP_API_KEY");
  }

  // 1. Download & Cache (Skipped if recent & valid OR if skipDownload is true)
  if (!skipDownload) {
    await downloadAndCacheCSVs(fmpKey, years);
  }

  // 2. Get Universe
  const allActiveTickers = await getActiveStockTickers(supabaseAdmin);
  let activeSet = new Set(allActiveTickers);

  if (targetTicker) {
    debugLog(`[DEBUG] Target ticker requested: "${targetTicker}"`);
    debugLog(`[DEBUG] In active list: ${activeSet.has(targetTicker)}`);
    if (!activeSet.has(targetTicker)) {
      // Allow processing even if not in active list (for testing)
      activeSet = new Set([targetTicker]);
    } else {
      activeSet = new Set([targetTicker]);
    }
    debugLog(`[DEBUG] activeSet after filter: ${Array.from(activeSet)}`);
  }

  // Apply offset first, then limit
  if (offset > 0 || (limit && limit > 0)) {
    const arr = Array.from(activeSet);
    const start = offset;
    const end = limit ? start + limit : arr.length;
    const sliced = arr.slice(start, end);
    activeSet = new Set(sliced);
    console.log(
      `[financials-bulk] Applied offset=${offset}, limit=${limit || "none"}: processing tickers ${start} to ${end - 1} (${sliced.length} total)`,
    );
  }

  // 3. Parse & Process
  // Streaming approach: We need to parse ALL files (filtered by ticker) and build metrics
  // To avoid memory overflow, we can't load ALL rows for ALL tickers at once if universe is huge.
  // But parseCachedCSVs loads by file (year/period).
  // The issue is `persistFinancialsStreaming` expects ALL data for the tickers it processes.

  // STRATEGY:
  // We can process tickers in chunks.
  // For each chunk of tickers:
  //   - Call parseCachedCSVs(chunkTickers) -> Returns rows ONLY for these tickers
  //   - Call persistFinancialsStreaming(chunkTickers, data)

  // Validate batchSize range (50-2000)
  // Each ticker generates ~10 rows, so 2000 tickers = ~20,000 rows
  // With upsert chunks of 5000 rows, this means ~4 upsert queries per 2000 tickers
  // Payload size: 20,000 rows × 600 bytes = 12 MB (chunked into 5000-row batches = 3 MB each)
  const TICKER_BATCH_SIZE = Math.max(50, Math.min(2000, batchSize));
  const tickerList = Array.from(activeSet);
  const stats = {
    processed: 0,
    skipped: 0,
    fy_built: 0,
    q_built: 0,
    ttm_built: 0,
  };

  console.log(
    `[financials-bulk] Processing ${tickerList.length} tickers in batches of ${TICKER_BATCH_SIZE}...`,
  );

  for (let i = 0; i < tickerList.length; i += TICKER_BATCH_SIZE) {
    const batchTickers = tickerList.slice(i, i + TICKER_BATCH_SIZE);
    const batchSet = new Set(batchTickers);

    debugLog(
      `[financials-bulk] Batch ${i / TICKER_BATCH_SIZE + 1}: ${batchTickers[0]} ... ${batchTickers[batchTickers.length - 1]}`,
    );

    // Pass forceUpdate here
    let data = await parseCachedCSVs(batchSet, years, forceUpdate);

    const batchStats = await persistFinancialsStreaming(
      batchTickers,
      data,
      5000,
    );

    stats.processed += batchStats.processed;
    stats.skipped += batchStats.skipped;
    stats.fy_built += batchStats.fy_built;
    stats.q_built += batchStats.q_built;
    stats.ttm_built += batchStats.ttm_built;

    // GC hint
    (data as any) = null;
  }

  // Final Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log(`📊 FINANCIALS BULK - FINAL SUMMARY`);
  console.log(`${"=".repeat(70)}`);
  console.log(`Total tickers in scope: ${tickerList.length}`);
  console.log(
    `✅ Processed (new/updated): ${stats.processed} (${Math.round((stats.processed / tickerList.length) * 100)}%)`,
  );
  console.log(
    `⏩ Skipped (cached): ${stats.skipped} (${Math.round((stats.skipped / tickerList.length) * 100)}%)`,
  );
  console.log(`📈 Metrics built:`);
  console.log(`   - FY rows: ${stats.fy_built}`);
  console.log(`   - Q rows: ${stats.q_built}`);
  console.log(`   - TTM rows: ${stats.ttm_built}`);
  console.log(
    `   - Total rows: ${stats.fy_built + stats.q_built + stats.ttm_built}`,
  );
  console.log(`${"=".repeat(70)}\n`);

  return stats;
}
