import { NextResponse } from 'next/server';
import { runIndustryBenchmarksAggregator } from './core';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runIndustryBenchmarksAggregator();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[industry-benchmarks] Route error:', err);
    return NextResponse.json(
      {
        ok: false,
        as_of_date: null,
        industries_processed: 0,
        rows_written: 0,
        rows_skipped: 0,
      },
      { status: 500 },
    );
  }
}

