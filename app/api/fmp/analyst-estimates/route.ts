// app/api/fmp/analyst-estimates/route.ts
import { NextRequest } from 'next/server';
import https from 'https';

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

  return new Promise((resolve) => {
    const path = `/api/v3/analyst-estimates/${encodeURIComponent(symbol)}?apikey=${API_KEY}&period=${period}&limit=${limit}&page=${page}`;
    
    const options = {
      hostname: 'financialmodelingprep.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'Fintra-App/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve(new Response(JSON.stringify({ 
              error: `FMP API error: ${res.statusCode}`,
              details: res.statusMessage 
            }), {
              status: res.statusCode || 500,
              headers: { 'Content-Type': 'application/json' },
            }));
            return;
          }
          
          const jsonData = JSON.parse(data);
          
          resolve(new Response(JSON.stringify(jsonData), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }));
        } catch (err) {
          resolve(new Response(JSON.stringify({ 
            error: 'Failed to parse API response',
            details: err instanceof Error ? err.message : 'Unknown error'
          }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }));
        }
      });
    });
    
    req.on('error', (error) => {
      resolve(new Response(JSON.stringify({ 
        error: 'Failed to connect to FMP API',
        details: error.message
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(new Response(JSON.stringify({ 
        error: 'Request timeout',
        details: 'The request to FMP API timed out'
      }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    
    req.end();
  });
}
