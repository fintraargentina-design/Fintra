import { NextResponse } from 'next/server';
import dayjs from 'dayjs';
import { backfillSnapshotsForDate } from './backfillSnapshots';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min timeout

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date') || dayjs().format('YYYY-MM-DD');
        const ticker = searchParams.get('ticker') || undefined;

        await backfillSnapshotsForDate(date, ticker);

        return NextResponse.json({ success: true, date, ticker });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
