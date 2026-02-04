import { NextResponse } from 'next/server';
import { runFmpBatch } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const offset = Number(searchParams.get('offset') ?? 0);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : undefined;
  const ticker = searchParams.get('ticker') || undefined;

  try {
    const result = await runFmpBatch(ticker, limit, offset);
    return NextResponse.json(result);
  } catch (err: any) {
      // Return 500 but as json
      return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
