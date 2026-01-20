import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { subDays, subMonths, subYears, startOfYear, format } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValueItem = {
  value: number | null;
  display: string | null;
  normalized: number | null;
  period_type: null;
  period_end_date?: string;
};

type Metric = {
  key: string;
  label: string;
  unit: string;
  category: "performance";
  priority: "A";
  heatmap: {
    direction: "higher_is_better" | "lower_is_better";
    scale: "relative_row";
  };
  values: Record<string, ValueItem>;
};

type YearGroup = {
  year: number;
  tone: "light" | "dark";
  columns: string[];
};

type ResponseContract = {
  ticker: string;
  currency: string;
  years: YearGroup[];
  metrics: Metric[];
};

const WINDOWS = [
  { code: "1D", days: 1 },
  { code: "1W", days: 7 },
  { code: "1M", months: 1 },
  { code: "3M", months: 3 },
  { code: "6M", months: 6 },
  { code: "YTD", isYTD: true },
  { code: "1Y", years: 1 },
  { code: "3Y", years: 3 },
  { code: "5Y", years: 5 },
  { code: "10Y", years: 10 },
] as const;

function subtractDate(dateStr: string, opts: { days?: number; months?: number; years?: number; isYTD?: boolean }): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d); // Construct date in local time

  let result = date;
  if (opts.isYTD) {
    result = startOfYear(date);
  } else if (opts.days) {
    result = subDays(date, opts.days);
  } else if (opts.months) {
    result = subMonths(date, opts.months);
  } else if (opts.years) {
    result = subYears(date, opts.years);
  }
  
  return format(result, 'yyyy-MM-dd');
}

function formatDisplay(value: number | null): string | null {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : ""; 
  return `${sign}${value.toFixed(2)}%`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  try {
    // Fetch prices_daily (limit 4000 to cover >10 years of trading days)
    const { data: prices, error } = await supabase
      .from("prices_daily")
      .select("price_date, adj_close")
      .eq("ticker", ticker)
      .order("price_date", { ascending: false })
      .limit(4000);

    if (error) throw new Error(error.message);

    const priceHistory = prices || [];
    
    if (priceHistory.length === 0) {
      return NextResponse.json({
        ticker,
        currency: "USD",
        years: [],
        metrics: [],
      });
    }

    const latest = priceHistory[0];
    const latestDate = latest.price_date;
    const latestPrice = Number(latest.adj_close);

    const valuesObj: Record<string, ValueItem> = {};
    const columns: string[] = [];

    for (const w of WINDOWS) {
        const targetDate = subtractDate(latestDate, w);
        
        // Find closest previous trading day: first row where date <= targetDate
        const startRow = priceHistory.find(p => p.price_date <= targetDate);
        
        columns.push(w.code);

        if (startRow && startRow.adj_close !== null) {
            const startPrice = Number(startRow.adj_close);
            if (startPrice !== 0) {
                const ret = ((latestPrice / startPrice) - 1) * 100;
                valuesObj[w.code] = {
                    value: ret,
                    display: formatDisplay(ret),
                    normalized: null, // Neutral color
                    period_type: null,
                    period_end_date: latestDate
                };
            } else {
                 valuesObj[w.code] = { value: null, display: "—", normalized: null, period_type: null };
            }
        } else {
             valuesObj[w.code] = { value: null, display: "—", normalized: null, period_type: null };
        }
    }

    const years: YearGroup[] = [{
        year: 9999,
        tone: "light",
        columns: columns
    }];

    const metric: Metric = {
      key: "return_percent",
      label: "Retorno Absoluto",
      unit: "%",
      category: "performance",
      priority: "A",
      heatmap: {
        direction: "higher_is_better",
        scale: "relative_row",
      },
      values: valuesObj,
    };

    return NextResponse.json({
      ticker,
      currency: "USD",
      years,
      metrics: [metric],
    });

  } catch (err: any) {
    console.error("Performance Timeline API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
