import { NextResponse } from "next/server";
import { getValuationHistory } from "@/lib/services/ticker-view.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PeriodType = "FY" | "TTM" | null;

type ValueItem = {
  value: number | null;
  display: string | null;
  normalized: number | null;
  period_type: PeriodType;
  period_end_date?: string;
};

type Metric = {
  key: string;
  label: string;
  unit: string;
  category: "valuation";
  priority: "A" | "B" | "C";
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

const VALUATION_METRICS_CONFIG = [
  { key: "pe_ratio", label: "P/E", unit: "x", category: "valuation" as const, priority: "A" as const, dbCol: "pe_ratio", direction: "lower_is_better" as const },
  { key: "pe_forward", label: "Forward P/E", unit: "x", category: "valuation" as const, priority: "B" as const, dbCol: "pe_forward", direction: "lower_is_better" as const },
  { key: "peg_ratio", label: "PEG", unit: "x", category: "valuation" as const, priority: "B" as const, dbCol: "peg_ratio", direction: "lower_is_better" as const },
  { key: "price_to_book", label: "P/B", unit: "x", category: "valuation" as const, priority: "A" as const, dbCol: "price_to_book", direction: "lower_is_better" as const },
  { key: "price_to_sales", label: "P/S", unit: "x", category: "valuation" as const, priority: "B" as const, dbCol: "price_to_sales", direction: "lower_is_better" as const },
  { key: "price_to_fcf", label: "P/FCF", unit: "x", category: "valuation" as const, priority: "B" as const, dbCol: "price_to_fcf", direction: "lower_is_better" as const },
  { key: "ev_ebitda", label: "EV/EBITDA", unit: "x", category: "valuation" as const, priority: "A" as const, dbCol: "ev_ebitda", direction: "lower_is_better" as const },
  { key: "dividend_yield", label: "Div Yield", unit: "%", category: "valuation" as const, priority: "A" as const, dbCol: "dividend_yield", direction: "higher_is_better" as const },
] as const;

function formatDisplay(value: number | null, unit: string): string | null {
  if (value === null || value === undefined) return null;

  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "x") return `${value.toFixed(2)}x`;

  return value.toString();
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
    const today = new Date();
    const toDateString = (d: Date) => d.toISOString().slice(0, 10);

    const minusYears = (base: Date, years: number) => {
      const d = new Date(base.getTime());
      d.setFullYear(d.getFullYear() - years);
      return d;
    };

    const targetDates = {
      TTM: today,
    } as const;

    // Fetch from service (returns ascending)
    const valuationsAsc = await getValuationHistory(ticker);
    
    // Sort descending for the snapshot picker logic
    const valuations = [...valuationsAsc].sort((a, b) => 
      new Date(b.valuation_date).getTime() - new Date(a.valuation_date).getTime()
    );

    const pickSnapshot = (target: Date) => {
      if (!valuations.length) return null;
      const targetTime = target.getTime();
      for (const row of valuations) {
        const rowDate = new Date(row.valuation_date);
        if (rowDate.getTime() <= targetTime) return row;
      }
      return null;
    };

    const snapshotLabels = ["TTM"] as const;

    const snapshots: Record<(typeof snapshotLabels)[number], any | null> = {
      TTM: pickSnapshot(targetDates.TTM),
    };

    const yearsList: YearGroup[] = [
      {
        year: today.getFullYear(),
        tone: "light",
        columns: snapshotLabels.slice(),
      },
    ];

    const responseMetrics: Metric[] = [];

    for (const config of VALUATION_METRICS_CONFIG) {
      const valuesObj: Record<string, ValueItem> = {};
      const rawValues: number[] = [];

      for (const label of snapshotLabels) {
        const row = snapshots[label];

        let val: number | null = null;
        let endDate: string | undefined = undefined;

        if (row) {
          const raw = row[config.dbCol];
          if (raw !== null && raw !== undefined) {
            const num = Number(raw);
            if (!isNaN(num)) {
              val = num;
              endDate = row.valuation_date;
              rawValues.push(num);
            }
          }
        }

        valuesObj[label] = {
          value: val,
          display: val !== null ? formatDisplay(val, config.unit) : null,
          normalized: null,
          period_type: "TTM",
          period_end_date: endDate,
        };
      }

      if (rawValues.length > 0) {
        const min = Math.min(...rawValues);
        const max = Math.max(...rawValues);

        for (const label of snapshotLabels) {
          const item = valuesObj[label];
          if (item.value !== null) {
            item.normalized = normalize(item.value, min, max);
          }
        }
      }

      responseMetrics.push({
        key: config.key,
        label: config.label,
        unit: config.unit,
        category: "valuation",
        priority: config.priority,
        heatmap: {
          direction: config.direction,
          scale: "relative_row",
        },
        values: valuesObj,
      });
    }

    const response: ResponseContract = {
      ticker,
      currency: "USD",
      years: yearsList,
      metrics: responseMetrics,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Valuation Timeline API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
