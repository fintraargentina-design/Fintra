// FINTRA Stub — Reserved Route
// This file is intentionally reserved for a future milestone.
// The related database table already exists and will be used later.
// Do not remove this file. Do not partially implement logic here.
// Implementation will be added in a planned phase.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { message: 'FINTRA: backfillDates not implemented' },
    { status: 501 }
  );
}
