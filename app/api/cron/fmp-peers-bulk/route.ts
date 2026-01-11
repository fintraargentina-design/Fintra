import { NextResponse } from 'next/server';
import { runPeersBulk } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit')) || Infinity;
    const ticker = searchParams.get('ticker') || undefined;

    const result = await runPeersBulk(ticker, limit);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
