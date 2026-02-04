import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getLatestSnapshot } from '@/lib/repository/fintra-db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';

  try {
    const snapshot = await getLatestSnapshot(symbol);
    return NextResponse.json({ 
      success: true, 
      symbol, 
      snapshot,
      message: snapshot ? 'Snapshot found' : 'No snapshot found'
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
