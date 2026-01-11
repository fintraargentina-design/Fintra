import { NextResponse } from 'next/server';
import { runSectorBenchmarks } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    // Sector Benchmarks is an aggregation cron.
    // Running it for a single ticker (via query param) would corrupt the sector averages 
    // by calculating them based on a single company.
    // Therefore, we disable the 'ticker' parameter for production/HTTP execution.
    // Single-ticker debugging is still possible via scripts/debug-all.ts importing core directly.
    
    const result = await runSectorBenchmarks();

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
