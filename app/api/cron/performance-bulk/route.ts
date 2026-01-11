import { NextResponse } from 'next/server';
import { runPerformanceBulk } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const result = await runPerformanceBulk();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[PerformanceBulk] Critical error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
