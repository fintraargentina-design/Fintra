import { NextResponse } from 'next/server';
import { runCompanyProfileBulk } from './core';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');

  try {
    const result = await runCompanyProfileBulk(limitParam ? parseInt(limitParam) : undefined);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
