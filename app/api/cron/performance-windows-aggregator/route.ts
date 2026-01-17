import { NextResponse } from 'next/server';
import { runPerformanceWindowsAggregator } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const result = await runPerformanceWindowsAggregator();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[performance_windows_aggregator] Critical error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
