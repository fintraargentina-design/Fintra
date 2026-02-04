import { NextResponse } from 'next/server';
import { runSectorPerformanceAggregator } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await runSectorPerformanceAggregator();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Sector Performance Sync Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
