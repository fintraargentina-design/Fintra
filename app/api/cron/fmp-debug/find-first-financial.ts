import { NextResponse } from 'next/server';
import { loadFmpBulkOnce } from '@/lib/fmp/loadFmpBulkOnce';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  const fmp = await loadFmpBulkOnce();

  for (const income of fmp.income) {
    const symbol = income.symbol;

    const hasBalance = fmp.balance.some((b: any) => b.symbol === symbol);
    const hasCashflow = fmp.cashflow.some((c: any) => c.symbol === symbol);

    if (hasBalance && hasCashflow) {
      return NextResponse.json({
        ok: true,
        ticker: symbol,
        period: income.period
      });
    }
  }

  return NextResponse.json({
    ok: false,
    message: 'No ticker with full financials found'
  });
}
