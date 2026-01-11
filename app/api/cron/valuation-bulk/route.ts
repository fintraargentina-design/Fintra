import { NextResponse } from 'next/server';
import { runValuationBulk } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker') || undefined;

    // Production Route: NEVER enables debugMode.
    // If ticker is provided, it will filter the BULK CSV data, not call APIs.
    const result = await runValuationBulk({ targetTicker: ticker });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[ValuationBulk] Critical error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
