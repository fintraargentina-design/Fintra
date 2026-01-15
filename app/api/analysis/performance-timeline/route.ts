import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

const WINDOW_ORDER = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "10Y", "MAX"] as const;

function formatDisplay(value: number | null): string | null {
  if (value === null || value === undefined) return null;
  return `${value.toFixed(2)}%`;
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (val - min) / (max - min);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  try {
    const { data: perfData, error: perfError } = await supabase
      .from("datos_performance")
      .select("*")
      .eq("ticker", ticker)
      .order("performance_date", { ascending: true });

    if (perfError) {
      throw new Error(`Performance error for ${ticker}: ${perfError.message}`);
    }

    const performance = perfData || [];

    if (performance.length === 0) {
      const empty: ResponseContract = {
        ticker,
        currency: "USD",
        years: [],
        metrics: [],
      };
      return NextResponse.json(empty);
    }

    const latestDate = performance.reduce((acc: string, curr: any) =>
      curr.performance_date > acc ? curr.performance_date : acc,
      ""
    );

    const latestPerf = performance.filter((p: any) => p.performance_date === latestDate);

    const columns = latestPerf
      .map((p: any) => p.window_code as string)
      .filter((w) => !!w && WINDOW_ORDER.includes(w as any))
      .sort((a, b) => WINDOW_ORDER.indexOf(a as any) - WINDOW_ORDER.indexOf(b as any));

    const uniqueColumns = Array.from(new Set(columns));

    const years: YearGroup[] = uniqueColumns.length
      ? [
          {
            year: 9999,
            tone: "light",
            columns: uniqueColumns,
          },
        ]
      : [];

    const valuesObj: Record<string, ValueItem> = {};
    const rawValues: number[] = [];

    uniqueColumns.forEach((windowCode) => {
      const row = latestPerf.find((p: any) => p.window_code === windowCode);
      if (!row) return;

      const raw = row.return_percent;
      if (raw === null || raw === undefined) return;

      const val = Number(raw);
      if (isNaN(val)) return;

      rawValues.push(val);
      valuesObj[windowCode] = {
        value: val,
        display: formatDisplay(val),
        normalized: null,
        period_type: null,
        period_end_date: row.performance_date,
      };
    });

    if (rawValues.length > 0) {
      const min = Math.min(...rawValues);
      const max = Math.max(...rawValues);

      Object.keys(valuesObj).forEach((col) => {
        const item = valuesObj[col];
        if (item.value !== null) {
          item.normalized = normalize(item.value, min, max);
        }
      });
    }

    const metric: Metric = {
      key: "return_percent",
      label: "Total Return",
      unit: "%",
      category: "performance",
      priority: "A",
      heatmap: {
        direction: "higher_is_better",
        scale: "relative_row",
      },
      values: valuesObj,
    };

    const response: ResponseContract = {
      ticker,
      currency: "USD",
      years,
      metrics: rawValues.length ? [metric] : [],
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Performance Timeline API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
