import { NextResponse } from 'next/server';
import { checkSnapshotsHealth } from './core';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await checkSnapshotsHealth();
  return NextResponse.json(result);
}
