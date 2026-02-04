import { NextRequest, NextResponse } from 'next/server';
import { runFmpBulk } from './core';
import { withCronAuth } from '@/lib/middleware/cronAuth';
import { validateParams, FmpBulkParamsSchema, safeParseInt } from '@/lib/validation/cronParams';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = withCronAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  // Validate parameters
  const validation = validateParams(FmpBulkParamsSchema, {
    ticker: searchParams.get('ticker') || undefined,
    limit: safeParseInt(searchParams.get('limit'))
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: validation.error },
      { status: 400 }
    );
  }

  const { ticker, limit } = validation.data;

  try {
    const result = await runFmpBulk(ticker, limit);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
