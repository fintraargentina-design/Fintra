import { NextResponse } from 'next/server';
import { runIndustryPeAggregator } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    await runIndustryPeAggregator();
    return NextResponse.json({ ok: true, message: 'Industry PE Aggregator finished' });
  } catch (error: any) {
    console.error('Industry PE Aggregator failed:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
}

