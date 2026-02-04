import { NextResponse } from 'next/server';
import { loadFmpBulkOnce } from '@/lib/fmp/loadFmpBulkOnce';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fmp = await loadFmpBulkOnce();

  const sample = fmp.income.slice(0, 5);

  return NextResponse.json(
    sample.map((i: any) => ({
      symbol: i.symbol,
      period: i.period,
      revenue: i.revenue,
      netIncome: i.netIncome
    }))
  );
}
