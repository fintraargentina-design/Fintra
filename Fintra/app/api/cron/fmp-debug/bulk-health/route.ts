import { NextResponse } from 'next/server';
import { loadFmpBulkOnce } from '@/lib/fmp/loadFmpBulkOnce';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fmp = await loadFmpBulkOnce();

  return NextResponse.json({
    profiles: Array.isArray(fmp.profiles) ? fmp.profiles.length : null,
    income: Array.isArray(fmp.income) ? fmp.income.length : null,
    balance: Array.isArray(fmp.balance) ? fmp.balance.length : null,
    cashflow: Array.isArray(fmp.cashflow) ? fmp.cashflow.length : null,
    ratios: Array.isArray(fmp.ratios) ? fmp.ratios.length : null,
    metrics: Array.isArray(fmp.metrics) ? fmp.metrics.length : null
  });
}
