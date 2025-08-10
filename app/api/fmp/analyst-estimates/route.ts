// app/api/fmp/analyst-estimates/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol');
  const period = searchParams.get('period') ?? 'annual';
  const page   = searchParams.get('page')   ?? '0';
  const limit  = searchParams.get('limit')  ?? '10';

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'Missing symbol parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validar que tenemos una API key
  const API_KEY = process.env.FMP_API_KEY_SERVER ?? process.env.NEXT_PUBLIC_FMP_API_KEY;
  
  if (!API_KEY) {
    console.error('No API key found in environment variables');
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Usar v3 para consistencia
  const url = `https://financialmodelingprep.com/api/v3/analyst-estimates/${encodeURIComponent(symbol)}?apikey=${API_KEY}&period=${period}&limit=${limit}&page=${page}`;

  try {
    const r = await fetch(url, { cache: 'no-store' });
    
    if (!r.ok) {
      console.error(`FMP API error: ${r.status} - ${r.statusText}`);
      return new Response(JSON.stringify({ 
        error: `Financial Modeling Prep API error: ${r.status}`,
        details: r.statusText 
      }), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const body = await r.json();
    
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Fetch error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch from Financial Modeling Prep API',
      details: err instanceof Error ? err.message : 'Unknown error'
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
