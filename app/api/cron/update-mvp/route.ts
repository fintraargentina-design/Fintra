import { NextResponse } from 'next/server';
import { runUpdateMvp } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker') || undefined;

  try {
    const result = await runUpdateMvp(ticker);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
