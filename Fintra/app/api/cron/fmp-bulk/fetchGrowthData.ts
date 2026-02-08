import { SupabaseClient } from "@supabase/supabase-js";

export interface GrowthRow {
  date: string; // period_end_date
  fiscalYear: string; // period_label
  growthRevenue: number | null;
  growthNetIncome: number | null;
  growthFreeCashFlow: number | null;
}

export async function fetchFinancialHistory(
  supabase: SupabaseClient,
  tickers: string[],
) {
  if (!tickers.length) return new Map<string, any[]>();

  // FIX EGRESS: Limit to 5000 rows max (prevents unbounded queries)
  const { data, error } = await supabase
    .from("datos_financieros")
    .select(
      "ticker, period_end_date, period_label, revenue, net_income, free_cash_flow, roic, roe, operating_margin, net_margin, invested_capital, capex, weighted_shares_out, period_type",
    )
    .in("ticker", tickers)
    .in("period_type", ["FY", "Q", "TTM"]) // Fetch all types for Moat
    .order("period_end_date", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("❌ Error fetching financial history:", error);
    return new Map<string, any[]>();
  }

  // Group by ticker
  const map = new Map<string, any[]>();
  data?.forEach((row: any) => {
    if (!map.has(row.ticker)) map.set(row.ticker, []);
    map.get(row.ticker)!.push(row);
  });

  return map;
}

export async function fetchValuationHistory(
  supabase: SupabaseClient,
  tickers: string[],
) {
  if (!tickers.length) return new Map<string, any[]>();

  // FIX EGRESS: Limit to 1000 rows max (prevents unbounded queries)
  // Fetching last 5 years of valuation data might be heavy if daily.
  // For now, we fetch the last 1000 records to catch some history if available.
  // Ideally, we would filter by specific dates (today, -1Y, -3Y, -5Y).
  const { data, error } = await supabase
    .from("datos_valuacion")
    .select(
      "ticker, valuation_date, pe_ratio, ev_ebitda, price_to_fcf, price_to_sales",
    )
    .in("ticker", tickers)
    .order("valuation_date", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("❌ Error fetching valuation history:", error);
    return new Map<string, any[]>();
  }

  const map = new Map<string, any[]>();
  data?.forEach((row: any) => {
    if (!map.has(row.ticker)) map.set(row.ticker, []);
    map.get(row.ticker)!.push(row);
  });

  return map;
}

export function computeGrowthRows(financials: any[]): GrowthRow[] {
  // Sort by date ascending to calculate growth
  const sorted = [...financials].sort(
    (a, b) =>
      new Date(a.period_end_date).getTime() -
      new Date(b.period_end_date).getTime(),
  );

  const growthRows: GrowthRow[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];

    // Calculate YoY Growth
    const growthRevenue = prev.revenue
      ? (curr.revenue - prev.revenue) / Math.abs(prev.revenue)
      : null;
    const growthNetIncome = prev.net_income
      ? (curr.net_income - prev.net_income) / Math.abs(prev.net_income)
      : null;
    const growthFreeCashFlow = prev.free_cash_flow
      ? (curr.free_cash_flow - prev.free_cash_flow) /
        Math.abs(prev.free_cash_flow)
      : null;

    growthRows.push({
      date: curr.period_end_date,
      fiscalYear: curr.period_label,
      growthRevenue,
      growthNetIncome,
      growthFreeCashFlow,
    });
  }

  // Return in descending order (newest first) as usually expected by rolling helpers?
  // rollingFYGrowth sorts them anyway.
  return growthRows.reverse();
}

export async function fetchPerformanceHistory(
  supabase: SupabaseClient,
  tickers: string[],
) {
  if (!tickers.length) return new Map<string, any[]>();

  const { data, error } = await supabase
    .from("datos_performance")
    .select("ticker, window_code, return_percent, max_drawdown")
    .in("ticker", tickers)
    .in("window_code", ["1W", "1M", "YTD", "1Y", "3Y", "5Y"]);

  if (error) {
    console.error("❌ Error fetching performance history:", error);
    return new Map<string, any[]>();
  }

  // Group by ticker
  const map = new Map<string, any[]>();
  data?.forEach((row: any) => {
    if (!map.has(row.ticker)) map.set(row.ticker, []);
    map.get(row.ticker)!.push(row);
  });

  return map;
}

/**
 * Calculate days between two ISO date strings
 */
function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export async function fetchSectorPerformanceHistory(supabase: SupabaseClient) {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch latest sector performance available (tolerant to weekends/holidays)
  // 1. Get the most recent date
  const { data: latestDateRow } = await supabase
    .from("sector_performance")
    .select("performance_date")
    .order("performance_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const targetDate = latestDateRow?.performance_date;

  if (!targetDate) {
    console.warn("⚠️ No sector performance data found in DB.");
    return new Map<string, any[]>();
  }

  // Calculate age of data
  const dataAge = daysBetween(targetDate, today);

  // Log if using fallback data (older than today)
  if (targetDate !== today) {
    console.warn(
      `[SECTOR_PERFORMANCE] Using fallback data from ${targetDate} ` +
        `(requested ${today}, age: ${dataAge} days)`,
    );
  } else {
    console.log(`[SECTOR_PERFORMANCE] Using exact match for ${today}`);
  }

  const { data, error } = await supabase
    .from("sector_performance")
    .select("sector, window_code, return_percent, performance_date")
    .eq("performance_date", targetDate)
    .in("window_code", [
      "1D",
      "1W",
      "1M",
      "3M",
      "6M",
      "YTD",
      "1Y",
      "2Y",
      "3Y",
      "5Y",
    ]); // Fetch ALL windows for both IFS and Snapshot display

  if (error) {
    console.error("❌ Error fetching sector performance history:", error);
    return new Map<string, any[]>();
  }

  // Group by sector
  const map = new Map<string, any[]>();
  data?.forEach((row: any) => {
    if (!map.has(row.sector)) map.set(row.sector, []);
    map.get(row.sector)!.push(row);
  });

  console.log(
    `[SECTOR_PERFORMANCE] Loaded ${map.size} sectors from ${targetDate}`,
  );

  return map;
}

/**
 * Prefetch ALL industry_performance data globally to avoid N+1 queries
 * Returns nested map: industry → window_code → latest data
 */
export async function fetchIndustryPerformanceMap(
  supabase: SupabaseClient,
): Promise<Map<string, Map<string, any>>> {
  const today = new Date().toISOString().slice(0, 10);

  console.log("[PREFETCH] Loading industry_performance...");

  // FIX EGRESS + ROBUSTNESS: Use same fallback pattern as sector_performance
  // 1. Get the most recent date available (tolerant to cron delays/holidays)
  const { data: latestDateRow } = await supabase
    .from("industry_performance")
    .select("performance_date")
    .order("performance_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const targetDate = latestDateRow?.performance_date;

  if (!targetDate) {
    console.warn("⚠️ No industry performance data found in DB.");
    return new Map();
  }

  // Calculate age of data
  const dataAge =
    targetDate !== today
      ? Math.ceil(
          (new Date(today).getTime() - new Date(targetDate).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  // Log if using fallback data (older than today)
  if (targetDate !== today) {
    console.warn(
      `[PREFETCH] industry_performance: Using fallback data from ${targetDate} ` +
        `(requested ${today}, age: ${dataAge} days)`,
    );
  } else {
    console.log(
      `[PREFETCH] industry_performance: Using exact match for ${today}`,
    );
  }

  // 2. Query with exact date match (efficient, no egress explosion)
  const { data, error } = await supabase
    .from("industry_performance")
    .select("industry, window_code, return_percent, performance_date")
    .eq("performance_date", targetDate)
    .order("industry", { ascending: true });

  if (error) {
    console.error("❌ Error fetching industry performance:", error);
    return new Map();
  }

  // Build nested map: industry → window_code → latest row
  const industryMap = new Map<string, Map<string, any>>();

  for (const row of data || []) {
    if (!industryMap.has(row.industry)) {
      industryMap.set(row.industry, new Map());
    }

    const windowMap = industryMap.get(row.industry)!;

    // Keep only the latest entry per window_code (data is already ordered by date desc)
    if (!windowMap.has(row.window_code)) {
      windowMap.set(row.window_code, row);
    }
  }

  console.log(
    `[PREFETCH] ✅ Loaded ${industryMap.size} industries with performance data`,
  );
  return industryMap;
}

/**
 * Prefetch ALL fintra_universe data globally to avoid N+1 queries
 * Returns map: ticker → { sector, industry }
 */
export async function fetchUniverseMap(
  supabase: SupabaseClient,
): Promise<Map<string, { sector: string | null; industry: string | null }>> {
  console.log("[PREFETCH] Loading fintra_universe...");

  // CRITICAL: Supabase has server-side max-rows limit (usually 1000)
  // Must paginate explicitly to load all ~90k tickers
  const PAGE_SIZE = 1000; // Server max
  const allRows: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("fintra_universe")
      .select("ticker, sector, industry")
      .range(from, to)
      .order("ticker", { ascending: true }); // Ensure consistent pagination

    if (error) {
      console.error(
        `❌ Error fetching universe (page ${page}, rows ${from}-${to}):`,
        error,
      );
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      hasMore = data.length === PAGE_SIZE; // Continue if page is full
      page++;

      if (page % 10 === 0) {
        console.log(`[PREFETCH] ...loaded ${allRows.length} tickers so far`);
      }
    } else {
      hasMore = false;
    }
  }

  const universeMap = new Map(
    allRows.map((row: any) => [
      row.ticker,
      { sector: row.sector || null, industry: row.industry || null },
    ]),
  );

  console.log(
    `[PREFETCH] ✅ Loaded ${universeMap.size} tickers from universe (${page} pages)`,
  );
  return universeMap;
}
