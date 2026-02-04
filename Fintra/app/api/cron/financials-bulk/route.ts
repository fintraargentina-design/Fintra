import { NextResponse } from 'next/server';
import { runFinancialsBulk } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker') || undefined;

    const result = await runFinancialsBulk(ticker);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('❌ Financials Bulk Error:', err);
    return NextResponse.json(
      { error: err.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
