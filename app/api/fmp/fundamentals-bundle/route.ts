// app/api/fmp/fundamentals-bundle/route.ts
import { NextResponse } from 'next/server';
import { getFundamentalsBundle } from '@/api/fmpFundamentalsBundle';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol') || '';
    const period = searchParams.get('period') || 'annual';
    const limit = Number(searchParams.get('limit') || '10');

    if (!symbol) {
      return NextResponse.json({ error: 'symbol requerido' }, { status: 400 });
    }

    const data = await getFundamentalsBundle(symbol, { period, limit });
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error('fundamentals-bundle error:', err);
    return NextResponse.json(
      { error: err?.message || 'Error desconocido' },
      { status: 500 }
    );
  }
}
