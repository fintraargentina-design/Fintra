'use server';

import { supabase } from "@/lib/supabase";

export async function getBalanceHistory(ticker: string) {
  if (!ticker) return null;

  try {
    // 1. Get Revenue, Debt & Net Income (FY)
    // We order by period_end_date ascending to get chronological order
    const { data: financials, error: finError } = await supabase
      .from('datos_financieros')
      .select('period_label, revenue, total_debt, net_income, period_end_date')
      .eq('ticker', ticker)
      .eq('period_type', 'FY')
      .order('period_end_date', { ascending: true })
      .limit(10); // Last 10 years

    if (finError) throw finError;

    if (!financials || financials.length === 0) {
      return null;
    }

    // 2. Format Data
    const years: string[] = [];
    const revenue: number[] = [];
    const debt: number[] = [];
    const netIncome: number[] = [];

    financials.forEach((item) => {
      years.push(item.period_label);
      revenue.push(Number(item.revenue || 0));
      debt.push(Number(item.total_debt || 0));
      netIncome.push(Number(item.net_income || 0));
    });

    return {
      years,
      revenue,
      debt,
      netIncome
    };

  } catch (error) {
    console.error('Error in getBalanceHistory:', error);
    return null;
  }
}

export async function getPriceHistory(ticker: string) {
  if (!ticker) return [];

  try {
    const { data, error } = await supabase
      .from('datos_valuacion')
      .select('valuation_date, price')
      .eq('ticker', ticker)
      .order('valuation_date', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    // Map to OHLC format
    // Since we only have daily price (likely close), we use it for all fields
    return data.map((d) => ({
      date: d.valuation_date,
      open: Number(d.price),
      high: Number(d.price),
      low: Number(d.price),
      close: Number(d.price),
      volume: 0, // Not available
      // Add other fields expected by OHLC interface if needed, or cast
    }));

  } catch (error) {
    console.error('Error in getPriceHistory:', error);
    return [];
  }
}
