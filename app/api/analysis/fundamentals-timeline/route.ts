import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { 
  PeriodType, 
  ValueItem, 
  Metric, 
  YearGroup, 
  FundamentalsTimelineResponse 
} from "@/lib/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Config ---

const FUNDAMENTAL_METRICS_CONFIG = [
  { key: "gross_margin", label: "Gross Margin", unit: "%", category: "quality", priority: "A", dbCol: "gross_margin", direction: "higher_is_better" },
  { key: "operating_margin", label: "Operating Margin", unit: "%", category: "quality", priority: "A", dbCol: "operating_margin", direction: "higher_is_better" },
  { key: "net_margin", label: "Net Margin", unit: "%", category: "quality", priority: "A", dbCol: "net_margin", direction: "higher_is_better" },
  { key: "roe", label: "ROE", unit: "%", category: "quality", priority: "A", dbCol: "roe", direction: "higher_is_better" },
  { key: "roic", label: "ROIC", unit: "%", category: "quality", priority: "B", dbCol: "roic", direction: "higher_is_better" },

  { key: "total_debt", label: "Total Debt", unit: "$", category: "solvency", priority: "A", dbCol: "total_debt", direction: "lower_is_better" },
  { key: "debt_to_equity", label: "Debt/Equity", unit: "x", category: "solvency", priority: "A", dbCol: "debt_to_equity", direction: "lower_is_better" },
  { key: "current_ratio", label: "Current Ratio", unit: "x", category: "solvency", priority: "B", dbCol: "current_ratio", direction: "higher_is_better" },
  { key: "interest_coverage", label: "Interest Coverage", unit: "x", category: "solvency", priority: "B", dbCol: "interest_coverage", direction: "higher_is_better" },

  { key: "revenue", label: "Revenue", unit: "$", category: "growth", priority: "A", dbCol: "revenue", direction: "higher_is_better" },
  { key: "net_income", label: "Net Income", unit: "$", category: "growth", priority: "A", dbCol: "net_income", direction: "higher_is_better" },
  { key: "free_cash_flow", label: "Free Cash Flow", unit: "$", category: "growth", priority: "A", dbCol: "free_cash_flow", direction: "higher_is_better" },
  { key: "ebitda", label: "EBITDA", unit: "$", category: "growth", priority: "B", dbCol: "ebitda", direction: "higher_is_better" },
  { key: "revenue_cagr", label: "Rev. CAGR", unit: "%", category: "growth", priority: "B", dbCol: "revenue_cagr", direction: "higher_is_better" }
] as const;


// --- Helpers ---

function formatDisplay(value: number | null, unit: string): string | null {
  if (value === null || value === undefined) return null;
  
  if (unit === '$') {
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  }
  
  if (unit === '%') return `${value.toFixed(2)}%`;
  
  if (unit === 'x') return `${value.toFixed(2)}x`;
  
  return value.toString();
}

function normalize(val: number, min: number, max: number): number {
  if (max === min) return 0.5; // Avoid div by zero
  return (val - min) / (max - min);
}

// --- Logic Helpers ---

function identifyFinancialPeriods(financials: any[]): string[] {
  const periodMap = new Map<string, { year: number; type: PeriodType; date: string }>();

  financials.forEach((row) => {
    const label: string | null = row.period_label;
    let type: PeriodType = row.period_type as PeriodType;

    if (!label) return;

    let formattedLabel = label;
    const year = parseInt(label.slice(0, 4));

    if (label.length === 4) {
      formattedLabel = `${label}_FY`;
      type = "FY";
    } else if (label.includes("Q")) {
      formattedLabel = label.replace("Q", "_Q");
    } else if (label.includes("TTM")) {
      formattedLabel = label.replace("TTM", "_TTM");
    }

    if (!["Q", "FY", "TTM"].includes(type || "")) return;

    periodMap.set(formattedLabel, {
      year,
      type,
      date: row.period_end_date,
    });
  });

  return Array.from(periodMap.keys()).sort((a, b) => {
    const [yA, tA] = a.split("_");
    const [yB, tB] = b.split("_");
    if (yA !== yB) return parseInt(yA) - parseInt(yB);

    const order = ["Q1", "Q2", "Q3", "Q4", "FY", "TTM"];
    const idxA = order.indexOf(tA);
    const idxB = order.indexOf(tB);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    return a.localeCompare(b);
  });
}

// --- Handler ---

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();
  const peerTicker = searchParams.get("peerTicker")?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  try {
    const { data: financialsData, error: finError } = await supabase
      .from("datos_financieros")
      .select("*")
      .eq("ticker", ticker)
      .order("period_end_date", { ascending: true });

    if (finError) {
      throw new Error(`Financials error for ${ticker}: ${finError.message}`);
    }

    const financials = financialsData || [];

    const sortedPeriods = identifyFinancialPeriods(financials);

    const periodMap = new Map<string, { year: number; type: PeriodType; date: string }>();

    financials.forEach((row) => {
      const label: string | null = row.period_label;
      if (!label) return;

      let formattedLabel = label;
      if (label.length === 4) {
        formattedLabel = `${label}_FY`;
      } else if (label.includes("Q")) {
        formattedLabel = label.replace("Q", "_Q");
      } else if (label.includes("TTM")) {
        formattedLabel = label.replace("TTM", "_TTM");
      }

      if (!sortedPeriods.includes(formattedLabel)) return;

      periodMap.set(formattedLabel, {
        year: parseInt(formattedLabel.slice(0, 4)),
        type: row.period_type as PeriodType,
        date: row.period_end_date,
      });
    });

    const yearsMap = new Map<number, string[]>();
    sortedPeriods.forEach((p) => {
      const entry = periodMap.get(p);
      if (!entry) return;
      const year = entry.year;
      if (!yearsMap.has(year)) yearsMap.set(year, []);
      yearsMap.get(year)!.push(p);
    });

    const yearsList: YearGroup[] = [];
    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => a - b);

    sortedYears.forEach((year, index) => {
      yearsList.push({
        year,
        tone: index % 2 === 0 ? "light" : "dark",
        columns: yearsMap.get(year)!,
      });
    });

    const responseMetrics: Metric[] = [];

    const findFinRow = (col: string) => {
      const clean = col.replace("_", "");
      return financials.find(
        (f) =>
          f.period_label === clean ||
          f.period_label === col ||
          (col.endsWith("_FY") && f.period_label === col.split("_")[0])
      );
    };

    for (const config of FUNDAMENTAL_METRICS_CONFIG) {
      const valuesObj: Record<string, ValueItem> = {};
      const rawValues: number[] = [];

      for (const col of sortedPeriods) {
        let val: number | null = null;
        let periodType: PeriodType = null;
        let endDate: string | undefined = undefined;

        const row = findFinRow(col);
        if (row) {
          const raw = row[config.dbCol];
          if (raw !== null && raw !== undefined) {
            val = Number(raw);
            if (!isNaN(val)) {
              periodType = row.period_type as PeriodType;
              endDate = row.period_end_date;
            } else {
              val = null;
            }
          }
        }

        if (val !== null) {
          rawValues.push(val);
          valuesObj[col] = {
            value: val,
            display: formatDisplay(val, config.unit),
            normalized: null,
            period_type: periodType,
            period_end_date: endDate,
          };
        }
      }

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

      responseMetrics.push({
        key: config.key,
        label: config.label,
        unit: config.unit,
        category: config.category,
        priority: config.priority,
        heatmap: {
          direction: config.direction,
          scale: "relative_row",
        },
        values: valuesObj,
      } as Metric);
    }

    // 6. Construct Final Response
    const response: FundamentalsTimelineResponse = {
      ticker,
      currency: "USD",
      years: yearsList,
      metrics: responseMetrics,
    };

    return NextResponse.json(response);

  } catch (err: any) {
    console.error("Timeline API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
