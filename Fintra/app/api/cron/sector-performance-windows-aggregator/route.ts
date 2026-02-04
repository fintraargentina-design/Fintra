import { NextResponse } from 'next/server';
import { runSectorPerformanceWindowsAggregator } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSectorPerformanceWindowsAggregator();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[sector-performance-windows] Route error:', err);
    return NextResponse.json(
      {
        ok: false,
        as_of_date: null,
        windows_written: 0,
        sectors_processed: 0,
        windows_skipped: 0,
        error: err?.message || 'Internal error',
      },
      { status: 500 },
    );
  }
}

