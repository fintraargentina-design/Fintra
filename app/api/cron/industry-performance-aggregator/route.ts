import { NextResponse } from 'next/server';
import { runIndustryPerformanceAggregator } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function GET() {
  try {
    await runIndustryPerformanceAggregator();
    return NextResponse.json({ ok: true, message: 'Industry Performance Aggregator finished' });
  } catch (error: any) {
    console.error('Industry Performance Aggregator failed:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
