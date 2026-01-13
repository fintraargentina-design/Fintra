import { NextResponse } from 'next/server';
import { getLivePrice, checkIpRateLimit } from '@/lib/services/live-price-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Prevent Next.js static optimization

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');

  // 1. Validation
  if (!ticker || typeof ticker !== 'string') {
    return NextResponse.json(
      { error: 'Ticker is required' },
      { status: 400 }
    );
  }

  // Normalize
  const upperTicker = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.\-\^]+$/.test(upperTicker)) {
      return NextResponse.json(
        { error: 'Invalid ticker format' },
        { status: 400 }
      );
  }

  // 2. Rate Limiting (Internal IP)
  // In Next.js App Router, finding IP can be tricky depending on proxy.
  // We check standard headers.
  const ip = (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0];
  
  if (!checkIpRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // 3. Service Call
  const { data, error } = await getLivePrice(upperTicker);

  if (error || !data) {
    return NextResponse.json(
      { error: error || 'Unknown error' },
      { status: 503 }
    );
  }

  // 4. Response
  return NextResponse.json(data, {
    status: 200,
    headers: {
      // We control caching manually, but can suggest short browser cache
      'Cache-Control': 'no-store, max-age=0', 
    },
  });
}
