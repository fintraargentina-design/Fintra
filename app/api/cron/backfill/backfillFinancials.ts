// cron/backfill/backfillFinancials.ts

import { supabase } from '@/lib/supabase';
import { getBulkFinancialData } from '../shared/bulkCache';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isSameOrBefore);

export async function backfillFinancialsForDate(date: string) {
  const asOf = dayjs(date);

  // 1. Obtener data bulk cacheada
  const {
    incomeStatements,
    balanceSheets,
    cashFlows,
    ratios
  } = await getBulkFinancialData();

  const rows: any[] = [];

  for (const ticker of Object.keys(incomeStatements)) {
    // -------------------------
    // FY / Q válidos hasta date
    // -------------------------
    const income = incomeStatements[ticker]
      .filter((r: any) => dayjs(r.date).isSameOrBefore(asOf))
      .sort((a: any, b: any) => dayjs(b.date).diff(dayjs(a.date)));

    const balance = balanceSheets[ticker]
      .filter((r: any) => dayjs(r.date).isSameOrBefore(asOf))
      .sort((a: any, b: any) => dayjs(b.date).diff(dayjs(a.date)));

    const cash = cashFlows[ticker]
      .filter((r: any) => dayjs(r.date).isSameOrBefore(asOf))
      .sort((a: any, b: any) => dayjs(b.date).diff(dayjs(a.date)));

    if (!income.length || !balance.length || !cash.length) continue;

    // -------------------------
    // Tomar el último FY/Q
    // -------------------------
    const latestIncome = income[0];
    const latestBalance = balance[0];
    const latestCash = cash[0];

    const periodType = latestIncome.period === 'FY' ? 'FY' : 'Q';
    const periodLabel = latestIncome.period;

    rows.push({
      ticker,
      period_type: periodType,
      period_label: periodLabel,
      period_end_date: latestIncome.date,

      revenue: latestIncome.revenue,
      net_income: latestIncome.netIncome,

      gross_margin: latestIncome.grossProfitRatio,
      operating_margin: latestIncome.operatingIncomeRatio,
      net_margin: latestIncome.netIncomeRatio,

      free_cash_flow: latestCash.freeCashFlow,

      total_debt: latestBalance.totalDebt,
      total_equity: latestBalance.totalStockholdersEquity,

      debt_to_equity:
        latestBalance.totalStockholdersEquity > 0
          ? latestBalance.totalDebt / latestBalance.totalStockholdersEquity
          : null,

      interest_coverage: ratios?.[ticker]?.interestCoverage,

      ebitda: latestIncome.ebitda,

      source: 'FMP',
      data_completeness: 100,
      data_freshness: 100
    });
  }

  // -------------------------
  // UPSERT datos_financieros
  // -------------------------
  if (rows.length) {
    const { error } = await supabase
      .from('datos_financieros')
      .upsert(rows, {
        onConflict: 'ticker,period_type,period_label'
      });

    if (error) throw error;
  }
}
