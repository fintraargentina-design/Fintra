import { NextRequest, NextResponse } from 'next/server';
import { runPricesDailyBulk } from '@/app/api/cron/prices-daily-bulk/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;
    const ticker = searchParams.get('ticker') || undefined;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;

    const result = await runPricesDailyBulk({ date, ticker, limit });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Cron] prices-daily-bulk failed:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
