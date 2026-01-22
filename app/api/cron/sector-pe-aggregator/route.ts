import { NextResponse } from 'next/server';
import { runSectorPeAggregator } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSectorPeAggregator();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[sector-pe-aggregator] Route error:', err);
    return NextResponse.json(
      {
        ok: false,
        date: null,
        processed: 0,
        errors: [err?.message || 'Internal error'],
      },
      { status: 500 },
    );
  }
}

