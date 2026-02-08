import { NextResponse } from "next/server";
import { getPerformanceHistory, PerformanceHistory } from "@/lib/services/ticker-view.service";
import { 
  Metric, 
  ValueItem, 
  YearGroup 
} from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOWS = [
  { code: "1D" },
  { code: "1W" },
  { code: "1M" },
  { code: "3M" },
  { code: "6M" },
  { code: "YTD" },
  { code: "1Y" },
  { code: "3Y" },
  { code: "5Y" },
  { code: "10Y" },
] as const;

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
    // Fetch performance history from service
    const perfRows = await getPerformanceHistory(ticker);
    
    // Map window_code -> latest row
    // Since rows are ordered by date ascending, the last entry for a window is the latest.
    const latestPerfMap = new Map<string, PerformanceHistory>();
    perfRows.forEach(row => {
        latestPerfMap.set(row.window_code, row);
    });

    const valuesObj: Record<string, ValueItem> = {};
    const columns: string[] = [];

    for (const w of WINDOWS) {
        columns.push(w.code);
        const row = latestPerfMap.get(w.code);

        if (row && row.return_percent !== null) {
             // Assuming DB stores decimal (e.g. 0.05 for 5%), and we want 5.0 for display
             const val = Number(row.return_percent) * 100;
             valuesObj[w.code] = {
                 value: val,
                 display: formatDisplay(val),
                 normalized: null,
                 period_type: null,
                 period_end_date: row.performance_date
             };
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
