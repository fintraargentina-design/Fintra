// Fintra\lib\fmp\processTickerFromBulk.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function processTickerFromBulk(
  ticker: string,
  fmp: any
) {
  // 1️⃣ Intentar TTM primero
  let income = fmp.income.find((i: any) => i.symbol === ticker);
  let balance = fmp.balance.find((b: any) => b.symbol === ticker);
  let cashflow = fmp.cashflow.find((c: any) => c.symbol === ticker);

  let periodType = 'TTM';

  // 2️⃣ Fallback a FY si falta algo
  if (!income || !balance || !cashflow) {
    const incomeFY = fmp.income.find(
      (i: any) => i.symbol === ticker && i.period === 'FY'
    );
    const balanceFY = fmp.balance.find(
      (b: any) => b.symbol === ticker && b.period === 'FY'
    );
    const cashflowFY = fmp.cashflow.find(
      (c: any) => c.symbol === ticker && c.period === 'FY'
    );

    if (!incomeFY || !balanceFY || !cashflowFY) {
      console.log(`⏭️ ${ticker} sin financials TTM ni FY`);
      return;
    }

    income = incomeFY;
    balance = balanceFY;
    cashflow = cashflowFY;
    periodType = 'FY';
  }

  // 3️⃣ Insertar datos financieros
  const row = {
    ticker,
    period_type: periodType,
    period_label: periodType,
    period_end_date: income.date ?? new Date().toISOString().slice(0, 10),

    revenue: Number(income.revenue) || null,
    net_income: Number(income.netIncome) || null,

    gross_margin: Number(income.grossProfitRatio) || null,
    operating_margin: Number(income.operatingIncomeRatio) || null,
    net_margin: Number(income.netIncomeRatio) || null,

    free_cash_flow: Number(cashflow.freeCashFlow) || null,

    source: 'FMP'
  };

  const { error } = await supabase
    .from('datos_financieros')
    .upsert(row, {
      onConflict: 'ticker,period_type,period_label'
    });

  if (error) throw error;

  console.log(`✅ ${ticker} financials guardados (${periodType})`);
}
