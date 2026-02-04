import { NextResponse } from 'next/server';
import { runPostBackfillValidation } from './runPostBackfillValidation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  try {
    await runPostBackfillValidation();
    return NextResponse.json({
      ok: true,
      message: 'Validaciones OK'
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message
      },
      { status: 500 }
    );
  }
}
