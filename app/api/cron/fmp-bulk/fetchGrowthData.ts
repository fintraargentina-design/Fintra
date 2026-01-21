
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
    .select('ticker, period_end_date, period_label, revenue, net_income, free_cash_flow, roic, roe, operating_margin, net_margin, invested_capital, capex, weighted_shares_out, period_type')
    .in('ticker', tickers)
    .in('period_type', ['FY', 'Q', 'TTM']) // Fetch all types for Moat
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

export async function fetchValuationHistory(
  supabase: SupabaseClient,
  tickers: string[]
) {
  if (!tickers.length) return new Map<string, any[]>();

  // Fetching last 5 years of valuation data might be heavy if daily.
  // For now, we fetch the last 100 records per ticker to try to catch some history if available.
  // Ideally, we would filter by specific dates (today, -1Y, -3Y, -5Y).
  const { data, error } = await supabase
    .from('datos_valuacion')
    .select('ticker, valuation_date, pe_ratio, ev_ebitda, price_to_fcf, price_to_sales')
    .in('ticker', tickers)
    .order('valuation_date', { ascending: false });

  if (error) {
    console.error('❌ Error fetching valuation history:', error);
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

export async function fetchPerformanceHistory(
  supabase: SupabaseClient,
  tickers: string[]
) {
  if (!tickers.length) return new Map<string, any[]>();

  const { data, error } = await supabase
    .from('datos_performance')
    .select('ticker, window_code, return_percent, max_drawdown')
    .in('ticker', tickers)
    .in('window_code', ['1W', '1M', 'YTD', '1Y', '3Y', '5Y']);

  if (error) {
    console.error('❌ Error fetching performance history:', error);
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

export async function fetchSectorPerformanceHistory(
  supabase: SupabaseClient
) {
  // Fetch latest sector performance for all sectors and all windows
  // Since we aggregate daily, we just take the latest one available.
  // Ideally, we filter by today's date or just take the latest.
  // Given the cron runs daily, filtering by date would be safer if we knew the exact date.
  // But to be robust, let's fetch recent records.
  
  const today = new Date().toISOString().slice(0, 10);
  
  const { data, error } = await supabase
    .from('sector_performance')
    .select('sector, window_code, return_percent, performance_date')
    .eq('performance_date', today)
    .in('window_code', ['1W', '1M', 'YTD', '1Y', '3Y', '5Y']);

  if (error) {
    console.error('❌ Error fetching sector performance history:', error);
    return new Map<string, any[]>();
  }

  // Group by sector
  const map = new Map<string, any[]>();
  data?.forEach((row: any) => {
    if (!map.has(row.sector)) map.set(row.sector, []);
    map.get(row.sector)!.push(row);
  });

  return map;
}
