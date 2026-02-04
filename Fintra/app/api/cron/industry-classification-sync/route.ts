import { NextResponse } from 'next/server';
import { runIndustryClassificationSync } from './core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await runIndustryClassificationSync();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[industry-classification-sync] Critical error:', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

