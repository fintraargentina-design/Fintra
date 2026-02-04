import { NextRequest, NextResponse } from 'next/server';
import { getTickerFullView } from '@/lib/services/ticker-view.service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    const data = await getTickerFullView(symbol);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API] Error fetching stock data for ${symbol}:`, error);
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 });
  }
}
