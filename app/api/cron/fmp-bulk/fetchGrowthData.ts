
import { SupabaseClient } from '@supabase/supabase-js';

export interface GrowthRow {
  date: string; // period_end_date
  fiscalYear: string; // period_label
  growthRevenue: number | null;
  growthNetIncome: number | null;
  growthFreeCashFlow: number | null;
}

export async function fetchFinancialHistory(
  supabase: SupabaseClient,
  tickers: string[]
) {
  if (!tickers.length) return new Map<string, any[]>();

  const { data, error } = await supabase
    .from('datos_financieros')
    .select('ticker, period_end_date, period_label, revenue, net_income, free_cash_flow')
    .in('ticker', tickers)
    .eq('period_type', 'FY')
    .order('period_end_date', { ascending: false });

  if (error) {
    console.error('❌ Error fetching financial history:', error);
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

export function computeGrowthRows(financials: any[]): GrowthRow[] {
  // Sort by date ascending to calculate growth
  const sorted = [...financials].sort((a, b) => 
    new Date(a.period_end_date).getTime() - new Date(b.period_end_date).getTime()
  );

  const growthRows: GrowthRow[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];

    // Calculate YoY Growth
    const growthRevenue = prev.revenue ? (curr.revenue - prev.revenue) / Math.abs(prev.revenue) : null;
    const growthNetIncome = prev.net_income ? (curr.net_income - prev.net_income) / Math.abs(prev.net_income) : null;
    const growthFreeCashFlow = prev.free_cash_flow ? (curr.free_cash_flow - prev.free_cash_flow) / Math.abs(prev.free_cash_flow) : null;

    growthRows.push({
      date: curr.period_end_date,
      fiscalYear: curr.period_label,
      growthRevenue,
      growthNetIncome,
      growthFreeCashFlow
    });
  }

  // Return in descending order (newest first) as usually expected by rolling helpers?
  // rollingFYGrowth sorts them anyway.
  return growthRows.reverse();
}
