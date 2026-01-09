import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- Types ---

type PeriodType = "Q" | "TTM" | "FY" | null;

type ValueItem = {
  value: number | null;
  display: string | null;
  normalized: number | null;
  period_type: PeriodType;
  period_end_date?: string;
  derived_from?: string[];
};

type Metric = {
  key: string;
  label: string;
  unit: string;
  category: "quality" | "solvency" | "growth" | "valuation" | "performance";
  priority: "A" | "B" | "C";
  heatmap: {
    direction: "higher_is_better" | "lower_is_better";
    scale: "relative_row";
  };
  values: Record<string, ValueItem>;
  meta?: {
    description: string;
    formula: string;
  };
};

type YearGroup = {
  year: number | string; // Allow string for "Performance" group if needed, though contract says number. We might use 9999 for sorting.
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
  // Quality
  { key: 'gross_margin', label: 'Gross Margin', unit: '%', category: 'quality', priority: 'A', dbCol: 'gross_margin', direction: 'higher_is_better' },
  { key: 'operating_margin', label: 'Operating Margin', unit: '%', category: 'quality', priority: 'A', dbCol: 'operating_margin', direction: 'higher_is_better' },
  { key: 'net_margin', label: 'Net Margin', unit: '%', category: 'quality', priority: 'A', dbCol: 'net_margin', direction: 'higher_is_better' },
  { key: 'roe', label: 'ROE', unit: '%', category: 'quality', priority: 'A', dbCol: 'roe', direction: 'higher_is_better' },
  { key: 'roic', label: 'ROIC', unit: '%', category: 'quality', priority: 'B', dbCol: 'roic', direction: 'higher_is_better' },

  // Solvency
  { key: 'total_debt', label: 'Total Debt', unit: '$', category: 'solvency', priority: 'A', dbCol: 'total_debt', direction: 'lower_is_better' },
  { key: 'debt_to_equity', label: 'Debt/Equity', unit: 'x', category: 'solvency', priority: 'A', dbCol: 'debt_to_equity', direction: 'lower_is_better' },
  { key: 'current_ratio', label: 'Current Ratio', unit: 'x', category: 'solvency', priority: 'B', dbCol: 'current_ratio', direction: 'higher_is_better' },
  { key: 'interest_coverage', label: 'Interest Coverage', unit: 'x', category: 'solvency', priority: 'B', dbCol: 'interest_coverage', direction: 'higher_is_better' },

  // Growth
  { key: 'revenue', label: 'Revenue', unit: '$', category: 'growth', priority: 'A', dbCol: 'revenue', direction: 'higher_is_better' },
  { key: 'net_income', label: 'Net Income', unit: '$', category: 'growth', priority: 'A', dbCol: 'net_income', direction: 'higher_is_better' },
  { key: 'free_cash_flow', label: 'Free Cash Flow', unit: '$', category: 'growth', priority: 'A', dbCol: 'free_cash_flow', direction: 'higher_is_better' },
  { key: 'ebitda', label: 'EBITDA', unit: '$', category: 'growth', priority: 'B', dbCol: 'ebitda', direction: 'higher_is_better' },
  { key: 'revenue_cagr', label: 'Rev. CAGR', unit: '%', category: 'growth', priority: 'B', dbCol: 'revenue_cagr', direction: 'higher_is_better' },

  // Valuation
  { key: 'pe_ratio', label: 'P/E', unit: 'x', category: 'valuation', priority: 'A', dbCol: 'pe_ratio', direction: 'lower_is_better' },
  { key: 'pe_forward', label: 'Forward P/E', unit: 'x', category: 'valuation', priority: 'B', dbCol: 'pe_forward', direction: 'lower_is_better' },
  { key: 'peg_ratio', label: 'PEG', unit: 'x', category: 'valuation', priority: 'B', dbCol: 'peg_ratio', direction: 'lower_is_better' },
  { key: 'price_to_book', label: 'P/B', unit: 'x', category: 'valuation', priority: 'A', dbCol: 'price_to_book', direction: 'lower_is_better' },
  { key: 'price_to_sales', label: 'P/S', unit: 'x', category: 'valuation', priority: 'B', dbCol: 'price_to_sales', direction: 'lower_is_better' },
  { key: 'price_to_fcf', label: 'P/FCF', unit: 'x', category: 'valuation', priority: 'B', dbCol: 'price_to_fcf', direction: 'lower_is_better' },
  { key: 'ev_ebitda', label: 'EV/EBITDA', unit: 'x', category: 'valuation', priority: 'A', dbCol: 'ev_ebitda', direction: 'lower_is_better' },
  { key: 'dividend_yield', label: 'Div Yield', unit: '%', category: 'valuation', priority: 'A', dbCol: 'dividend_yield', direction: 'higher_is_better' },
  
  // Performance (Special case: single metric row, multiple window columns)
  { key: 'return_percent', label: 'Total Return', unit: '%', category: 'performance', priority: 'A', dbCol: 'return_percent', direction: 'higher_is_better' }
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

// --- Handler ---

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase();

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  try {
    // 1. Fetch Data
    const [finRes, valRes, perfRes] = await Promise.all([
      supabase
        .from('datos_financieros')
        .select('*')
        .eq('ticker', ticker)
        .order('period_end_date', { ascending: true }),
      supabase
        .from('datos_valuacion')
        .select('*')
        .eq('ticker', ticker),
      supabase
        .from('datos_performance')
        .select('*')
        .eq('ticker', ticker)
        // We fetch all to filter for latest in memory or we could try to sort/limit per window
        // But simply fetching all for the ticker is safe for now (usually < 100 rows)
    ]);

    if (finRes.error) throw new Error(`Financials error: ${finRes.error.message}`);
    if (valRes.error) throw new Error(`Valuation error: ${valRes.error.message}`);
    if (perfRes.error) throw new Error(`Performance error: ${perfRes.error.message}`);

    const financials = finRes.data || [];
    const valuations = valRes.data || [];
    const performance = perfRes.data || [];

    // 2. Identify Financial Periods & Columns
    // Map: Label -> Year
    const periodMap = new Map<string, { year: number, type: PeriodType, date: string }>();

    financials.forEach(row => {
      // Normalize Label: 2023Q1 -> 2023_Q1, 2023 -> 2023_FY
      let label = row.period_label;
      let type: PeriodType = row.period_type as PeriodType;
      
      // Fix FMP inconsistency if any
      if (!label) return;
      
      // Convert to format YYYY_TYPE
      // Example DB: 2023Q1, 2023 (for FY)
      let formattedLabel = label;
      let year = parseInt(label.slice(0, 4));
      
      if (label.length === 4) {
          formattedLabel = `${label}_FY`;
          type = 'FY';
      } else if (label.includes('Q')) {
          formattedLabel = label.replace('Q', '_Q');
      } else if (label.includes('TTM')) {
          formattedLabel = label.replace('TTM', '_TTM');
      }

      periodMap.set(formattedLabel, {
        year,
        type,
        date: row.period_end_date
      });
    });

    // Also include Valuation periods if they exist and are not in financials (rare but possible)
    valuations.forEach(row => {
        if (!row.denominator_period) return;
        let label = row.denominator_period; // e.g. 2023FY, 2023Q3
        let year = parseInt(label.slice(0, 4));
        
        let formattedLabel = label;
        let type: PeriodType = row.denominator_type as PeriodType; // FY or TTM

        if (label.endsWith('FY')) {
             formattedLabel = label.replace('FY', '_FY');
        } else if (label.includes('Q')) { // Valuations usually on TTM or FY, but if Q exists
             formattedLabel = label.replace('Q', '_Q');
        } else if (label.includes('TTM')) {
             formattedLabel = label.replace('TTM', '_TTM');
        }

        if (!periodMap.has(formattedLabel)) {
             periodMap.set(formattedLabel, { year, type, date: row.valuation_date });
        }
    });

    // Sort periods
    const sortedPeriods = Array.from(periodMap.keys()).sort((a, b) => {
        // Sort by Year then by Quarter/Type
        const [yA, tA] = a.split('_');
        const [yB, tB] = b.split('_');
        if (yA !== yB) return parseInt(yA) - parseInt(yB);
        
        // Custom sort for periods: Q1 < Q2 < Q3 < Q4 < FY < TTM (or similar?)
        // Usually: Q1, Q2, Q3, Q4, FY. TTM is a rolling window, often ending same time as a Q.
        // Let's just use string sort for now, but Q < TTM?
        // 2023_Q1 < 2023_Q4 < 2023_TTM?
        return a.localeCompare(b);
    });

    // 3. Process Performance Columns
    // Identify latest performance date
    const maxPerfDate = performance.reduce((acc, curr) => 
        curr.performance_date > acc ? curr.performance_date : acc, "");
    
    // Filter performance rows for this date
    const latestPerf = performance.filter(p => p.performance_date === maxPerfDate);
    
    // Define ordering for windows
    const windowOrder = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', 'MAX'];
    const perfColumns = latestPerf
        .map(p => p.window_code)
        .filter(w => w) // ensure valid
        .sort((a, b) => {
            const idxA = windowOrder.indexOf(a);
            const idxB = windowOrder.indexOf(b);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });

    // 4. Build Years Structure
    const yearsMap = new Map<number, string[]>();
    sortedPeriods.forEach(p => {
        const year = periodMap.get(p)!.year;
        if (!yearsMap.has(year)) yearsMap.set(year, []);
        yearsMap.get(year)!.push(p);
    });

    const yearsList: YearGroup[] = [];
    const sortedYears = Array.from(yearsMap.keys()).sort((a, b) => a - b);
    
    sortedYears.forEach((year, index) => {
        yearsList.push({
            year,
            tone: index % 2 === 0 ? 'light' : 'dark',
            columns: yearsMap.get(year)!
        });
    });

    // Add Performance "Year" if data exists
    if (perfColumns.length > 0) {
        yearsList.push({
            year: 9999, // Signal for "Latest" or just render as "Perf" in frontend
            tone: yearsList.length % 2 === 0 ? 'light' : 'dark',
            columns: perfColumns
        });
    }

    // 5. Build Metrics Values
    const responseMetrics: Metric[] = [];

    // Helper to find financial row
    const findFinRow = (col: string) => {
        // Reverse map label: 2023_Q1 -> 2023Q1
        // Try both formats to be safe
        const clean = col.replace('_', ''); 
        return financials.find(f => 
            f.period_label === clean || 
            f.period_label === col ||
            (col.endsWith('_FY') && f.period_label === col.split('_')[0]) // 2023_FY -> 2023
        );
    };

    // Helper to find valuation row
    const findValRow = (col: string) => {
        // Need to match denominator_period
        const clean = col.replace('_', '');
        // Valuations can have multiple rows per period (different dates). We take the LATEST valuation_date.
        const matches = valuations.filter(v => 
             v.denominator_period === clean || 
             v.denominator_period === col ||
             (col.endsWith('_FY') && v.denominator_period === col.split('_')[0])
        );
        if (matches.length === 0) return null;
        // Sort by date desc
        return matches.sort((a, b) => b.valuation_date.localeCompare(a.valuation_date))[0];
    };

    // Helper to find performance row
    const findPerfRow = (window: string) => {
        return latestPerf.find(p => p.window_code === window);
    };

    for (const config of METRICS_CONFIG) {
        const valuesObj: Record<string, ValueItem> = {};
        const rawValues: number[] = [];

        // Iterate over ALL columns (Financials + Performance)
        const allColumns = [...sortedPeriods, ...perfColumns];

        for (const col of allColumns) {
            let val: number | null = null;
            let periodType: PeriodType = null;
            let endDate: string | undefined = undefined;

            if (config.category === 'performance') {
                // Only look in perf columns
                if (perfColumns.includes(col)) {
                    const row = findPerfRow(col);
                    if (row) {
                        val = Number(row[config.dbCol]);
                        periodType = null; 
                        endDate = row.performance_date;
                    }
                }
            } else if (config.category === 'valuation') {
                // Look in valuation data (only for period columns)
                if (sortedPeriods.includes(col)) {
                    const row = findValRow(col);
                    if (row) {
                        val = Number(row[config.dbCol]);
                        periodType = row.denominator_type as PeriodType;
                        endDate = row.valuation_date;
                    }
                }
            } else {
                // Fundamentals (growth, quality, solvency)
                if (sortedPeriods.includes(col)) {
                    const row = findFinRow(col);
                    if (row) {
                        val = Number(row[config.dbCol]);
                        periodType = row.period_type as PeriodType;
                        endDate = row.period_end_date;
                    }
                }
            }

            // Store raw for normalization
            if (val !== null && !isNaN(val)) {
                rawValues.push(val);
                
                valuesObj[col] = {
                    value: val,
                    display: formatDisplay(val, config.unit),
                    normalized: null, // fill later
                    period_type: periodType,
                    period_end_date: endDate
                };
            }
        }

        // Calculate Normalization
        if (rawValues.length > 0) {
            const min = Math.min(...rawValues);
            const max = Math.max(...rawValues);
            
            Object.keys(valuesObj).forEach(col => {
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
                scale: "relative_row"
            },
            values: valuesObj
        } as Metric);
    }

    // 6. Construct Final Response
    // NOTE: Currency is not available in allowed source tables. Defaulting to USD.
    const response: ResponseContract = {
        ticker: ticker,
        currency: "USD",
        years: yearsList,
        metrics: responseMetrics
    };

    return NextResponse.json(response);

  } catch (err: any) {
    console.error("Timeline API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
