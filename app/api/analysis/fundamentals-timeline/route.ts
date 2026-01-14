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

// --- Logic Helpers ---

function identifyFinancialPeriods(financials: any[], valuations: any[]): string[] {
    const periodMap = new Map<string, { year: number, type: PeriodType, date: string }>();

    financials.forEach(row => {
      let label = row.period_label;
      let type: PeriodType = row.period_type as PeriodType;
      
      if (!label) return;
      
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

      if (!['Q', 'FY', 'TTM'].includes(type || '')) return;

      periodMap.set(formattedLabel, {
        year,
        type,
        date: row.period_end_date
      });
    });

    valuations.forEach(row => {
        if (!row.denominator_period) return;
        let label = row.denominator_period;
        let year = parseInt(label.slice(0, 4));
        
        let formattedLabel = label;
        let type: PeriodType = row.denominator_type as PeriodType;

        if (label.endsWith('FY')) {
             formattedLabel = label.replace('FY', '_FY');
        } else if (label.includes('Q')) {
             formattedLabel = label.replace('Q', '_Q');
        } else if (label.includes('TTM')) {
             formattedLabel = label.replace('TTM', '_TTM');
        }

        if (type && !['FY', 'TTM'].includes(type)) return;

        if (!periodMap.has(formattedLabel)) {
             periodMap.set(formattedLabel, { year, type, date: row.valuation_date });
        }
    });

    return Array.from(periodMap.keys()).sort((a, b) => {
        const [yA, tA] = a.split('_');
        const [yB, tB] = b.split('_');
        if (yA !== yB) return parseInt(yA) - parseInt(yB);
        
        const order = ['Q1', 'Q2', 'Q3', 'Q4', 'FY', 'TTM'];
        const idxA = order.indexOf(tA);
        const idxB = order.indexOf(tB);
        
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.localeCompare(b);
    });
}

function identifyPerformanceColumns(performance: any[]): string[] {
    const maxPerfDate = performance.reduce((acc, curr) => 
        curr.performance_date > acc ? curr.performance_date : acc, "");
    
    const latestPerf = performance.filter(p => p.performance_date === maxPerfDate);
    
    const windowOrder = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', 'MAX'];
    return latestPerf
        .map(p => p.window_code)
        .filter(w => w && windowOrder.includes(w))
        .sort((a, b) => {
            const idxA = windowOrder.indexOf(a);
            const idxB = windowOrder.indexOf(b);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
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
    // 1. Fetch Data (Parallel for Main and Peer if present)
    const fetchTickerData = async (t: string) => {
        const [finRes, valRes, perfRes] = await Promise.all([
            supabase.from('datos_financieros').select('*').eq('ticker', t).order('period_end_date', { ascending: true }),
            supabase.from('datos_valuacion').select('*').eq('ticker', t).order('valuation_date', { ascending: true }),
            supabase.from('datos_performance').select('*').eq('ticker', t).order('performance_date', { ascending: true })
        ]);
        if (finRes.error) throw new Error(`Financials error for ${t}: ${finRes.error.message}`);
        if (valRes.error) throw new Error(`Valuation error for ${t}: ${valRes.error.message}`);
        if (perfRes.error) throw new Error(`Performance error for ${t}: ${perfRes.error.message}`);
        return {
            financials: finRes.data || [],
            valuations: valRes.data || [],
            performance: perfRes.data || []
        };
    };

    const mainData = await fetchTickerData(ticker);
    let peerData = null;
    if (peerTicker) {
        peerData = await fetchTickerData(peerTicker);
    }

    // 2. Identify Periods
    let sortedPeriods = identifyFinancialPeriods(mainData.financials, mainData.valuations);
    let perfColumns = identifyPerformanceColumns(mainData.performance);

    // 3. Align with Peer if needed
    if (peerData) {
        const peerPeriods = identifyFinancialPeriods(peerData.financials, peerData.valuations);
        const peerPerfCols = identifyPerformanceColumns(peerData.performance);

        // Intersect
        sortedPeriods = sortedPeriods.filter(p => peerPeriods.includes(p));
        perfColumns = perfColumns.filter(c => peerPerfCols.includes(c));
    }

    // Reconstruct Period Map for metadata (Year/Type/Date) using MAIN data
    // We need this to build the Years Structure
    // Note: We only need to rebuild the map for the filtered 'sortedPeriods'
    const periodMap = new Map<string, { year: number, type: PeriodType, date: string }>();
    
    // We can reuse the logic but optimized since we have the list of allowed periods
    // Or just run the extraction again on Main Data but only keep keys in sortedPeriods?
    // Let's iterate Main Data again but efficiently.
    
    // Actually, identifying periods is fast. We can just loop through mainData again to fill periodMap for the kept periods.
    mainData.financials.forEach(row => {
        let label = row.period_label;
        if (!label) return;
        let formattedLabel = label.length === 4 ? `${label}_FY` : (label.includes('Q') ? label.replace('Q', '_Q') : label.replace('TTM', '_TTM'));
        if (sortedPeriods.includes(formattedLabel)) {
             periodMap.set(formattedLabel, { 
                 year: parseInt(formattedLabel.slice(0, 4)), 
                 type: row.period_type as PeriodType, 
                 date: row.period_end_date 
             });
        }
    });
    mainData.valuations.forEach(row => {
        if (!row.denominator_period) return;
        let label = row.denominator_period;
        let formattedLabel = label.endsWith('FY') ? label.replace('FY', '_FY') : (label.includes('Q') ? label.replace('Q', '_Q') : label.replace('TTM', '_TTM'));
        if (sortedPeriods.includes(formattedLabel) && !periodMap.has(formattedLabel)) {
             periodMap.set(formattedLabel, { 
                 year: parseInt(formattedLabel.slice(0, 4)), 
                 type: row.denominator_type as PeriodType, 
                 date: row.valuation_date 
             });
        }
    });

    // 4. Build Years Structure
    const yearsMap = new Map<number, string[]>();
    sortedPeriods.forEach(p => {
        const year = periodMap.get(p)?.year;
        if (year) {
            if (!yearsMap.has(year)) yearsMap.set(year, []);
            yearsMap.get(year)!.push(p);
        }
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

    // Add Performance "Year" if data exists - SYNTHETIC YEAR 9999
    if (perfColumns.length > 0) {
        yearsList.push({
            year: 9999, // Performance Isolated Year
            tone: yearsList.length % 2 === 0 ? 'light' : 'dark',
            columns: perfColumns
        });
    }

    // 5. Build Metrics Values
    const responseMetrics: Metric[] = [];
    
    // Use mainData for values
    const financials = mainData.financials;
    const valuations = mainData.valuations;
    const latestPerf = mainData.performance.filter(p => 
        p.performance_date === mainData.performance.reduce((acc, curr) => curr.performance_date > acc ? curr.performance_date : acc, "")
    );

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

            // STRICT DOMAIN SEPARATION
            const isPerformanceCol = perfColumns.includes(col);
            const isFinancialCol = sortedPeriods.includes(col);

            if (config.category === 'performance') {
                // Performance Metrics: ONLY allowed in Performance Columns
                if (isPerformanceCol) {
                    const row = findPerfRow(col);
                    if (row) {
                        val = Number(row[config.dbCol]);
                        periodType = null; 
                        endDate = row.performance_date;
                    }
                }
            } else if (config.category === 'valuation') {
                // Valuation Metrics: ONLY allowed in Financial Columns
                // And specifically FY/TTM (enforced by periodMap construction, but good to be safe)
                if (isFinancialCol) {
                    const row = findValRow(col);
                    if (row) {
                        val = Number(row[config.dbCol]);
                        periodType = row.denominator_type as PeriodType;
                        endDate = row.valuation_date;
                    }
                }
            } else {
                // Fundamentals (growth, quality, solvency): ONLY allowed in Financial Columns
                if (isFinancialCol) {
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
