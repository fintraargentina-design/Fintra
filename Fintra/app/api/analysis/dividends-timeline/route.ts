import { NextResponse } from "next/server";
import { getDividendHistory } from "@/lib/services/ticker-view.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Types ---

type PeriodType = "FY"; // Dividends are typically annual in this table

type ValueItem = {
  value: number | null;
  display: string | null;
  normalized: number | null;
  period_type: PeriodType;
  period_end_date?: string; // Not strictly used for display in simple view but good for contract
};

type Metric = {
  key: string;
  label: string;
  unit: string;
  category: "dividends";
  priority: "A" | "B";
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

// --- Config ---

const METRICS_CONFIG = [
  { key: 'dividend_per_share', label: 'Dividend Per Share', unit: '$', category: 'dividends', priority: 'A', dbCol: 'dividend_per_share', direction: 'higher_is_better' },
  { key: 'dividend_yield', label: 'Dividend Yield', unit: '%', category: 'dividends', priority: 'A', dbCol: 'dividend_yield', direction: 'higher_is_better' },
  { key: 'payout_eps', label: 'Payout Ratio (EPS)', unit: '%', category: 'dividends', priority: 'A', dbCol: 'payout_eps', direction: 'lower_is_better' }, // Typically lower is safer, though too low is bad. User said "higher_is_better = false" in prompt.
  { key: 'payout_fcf', label: 'Payout Ratio (FCF)', unit: '%', category: 'dividends', priority: 'A', dbCol: 'payout_fcf', direction: 'lower_is_better' }, // User said "higher_is_better = false"
] as const;

// --- Helpers ---

function formatDisplay(value: number | null, unit: string): string | null {
  if (value === null || value === undefined) return null;
  
  if (unit === '$') {
    return `$${value.toFixed(2)}`;
  }
  
  if (unit === '%') return `${(value * 100).toFixed(2)}%`; // Assuming DB stores 0.05 for 5%?
  // Wait, existing fundamentals usually store raw values?
  // Let's check typical FMP data. Yield is usually percentage?
  // If yield is 0.05, we want 5.00%. If it's 5.0, we want 5.00%.
  // Looking at `DividendDividendRow` in `dividendSignals.ts`, it's `dividend_yield: number`.
  // Usually FMP bulk returns raw number.
  // I will assume it matches the convention: if it's small (<1), likely decimal. If >1, likely percent.
  // But safer to assume it's like fundamentals: usually decimal for ratios.
  // However, `dividend_yield` in `datos_dividendos` might be percentage or decimal.
  // Let's look at `evaluateDividendSignals`: `yield > 0.04` implies decimal (4%).
  // So I should multiply by 100 for display if unit is %.
  
  // Actually, for Payout Ratio (EPS/FCF), if it's 0.5, it's 50%.
  // So yes, multiply by 100 for %.
  
  return value.toString();
}

// Special formatter for our known units
function formatValue(val: number | null, key: string, unit: string): string | null {
    if (val === null) return "-";
    if (unit === '%') {
        // Heuristic: if val is 0.05, it's 5%. If it's 5, it's 500%? Or 5%?
        // Standard FMP data: Yield is usually decimal. Payout is decimal.
        return `${(val * 100).toFixed(2)}%`;
    }
    return `$${val.toFixed(2)}`;
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
    const rows = await getDividendHistory(ticker);

    if (!rows) return NextResponse.json({ ticker, currency: "USD", years: [], metrics: [] });

    // 1. Build Years Structure
    const yearsList: YearGroup[] = [];
    const yearColumnsMap = new Map<number, string>();

    rows.forEach((row, idx) => {
        const year = row.year;
        const colLabel = `${year}_FY`;
        yearColumnsMap.set(year, colLabel);
        
        yearsList.push({
            year,
            tone: idx % 2 === 0 ? 'light' : 'dark',
            columns: [colLabel]
        });
    });

    // 2. Build Metrics
    const responseMetrics: Metric[] = [];

    for (const config of METRICS_CONFIG) {
        const values: Record<string, ValueItem> = {};
        
        // Collect all values for normalization
        const rawValues: number[] = [];
        
        rows.forEach(row => {
            const val = row[config.dbCol as keyof typeof row];
            if (typeof val === 'number') rawValues.push(val);
        });

        const min = Math.min(...rawValues);
        const max = Math.max(...rawValues);

        rows.forEach(row => {
            const year = row.year;
            const colLabel = `${year}_FY`;
            const val = row[config.dbCol as keyof typeof row];
            
            let normalized: number | null = null;
            if (typeof val === 'number') {
                normalized = normalize(val, min, max);
            }

            values[colLabel] = {
                value: typeof val === 'number' ? val : null,
                display: formatValue(typeof val === 'number' ? val : null, config.key, config.unit),
                normalized,
                period_type: 'FY',
                period_end_date: `${year}-12-31` // Approximate
            };
        });

        responseMetrics.push({
            key: config.key,
            label: config.label,
            unit: config.unit,
            category: config.category,
            priority: config.priority,
            heatmap: {
                direction: config.direction as "higher_is_better" | "lower_is_better",
                scale: "relative_row"
            },
            values
        });
    }

    const response: ResponseContract = {
        ticker,
        currency: "USD", // Assumption, usually correct for FMP US stocks
        years: yearsList,
        metrics: responseMetrics
    };

    return NextResponse.json(response);

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
