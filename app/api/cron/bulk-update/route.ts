import { NextResponse } from 'next/server';
import { runBulkUpdate } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam) : undefined;
  const offsetParam = searchParams.get('offset');
  const offset = offsetParam ? parseInt(offsetParam) : undefined;
  const ticker = searchParams.get('ticker') || undefined;

  try {
    const result = await runBulkUpdate(ticker, limit, offset);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
