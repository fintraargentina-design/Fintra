import { NextResponse } from 'next/server';
import { runMarketStateBulk } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration

/**
 * CRON: Market State Bulk
 */
export async function GET() {
  try {
    const result = await runMarketStateBulk();
    return NextResponse.json(result);
  } catch (e: any) {
      console.error('🔥 Fatal Error in Market State Sync:', e);
      return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
