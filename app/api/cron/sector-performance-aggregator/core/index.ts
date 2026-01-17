import { supabaseAdmin } from '@/lib/supabase-admin';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';
const API_KEY = process.env.FMP_API_KEY;

interface FmpSectorPerf {
  sector: string;
  changesPercentage: string;
}

export async function runSectorPerformanceAggregator() {
  console.log('--- Starting Sector Performance Aggregator ---');

  if (!API_KEY) {
    throw new Error('FMP_API_KEY is missing');
  }

  const results = {
    processed: 0,
    errors: [] as string[],
  };

  // 1. Fetch Real-time (1D)
  try {
    const url = `${FMP_BASE_URL}/sectors-performance?apikey=${API_KEY}`;
    console.log(`Fetching: ${url}`);
    const res = await fetch(url);
    
    if (res.status === 403) {
       console.warn('FMP Sector Performance endpoint is 403 Forbidden (Legacy). Skipping 1D update.');
       results.errors.push('Realtime: 403 Forbidden (Legacy)');
    } else if (!res.ok) {
      throw new Error(`FMP API Error (Realtime): ${res.status} ${res.statusText}`);
    } else {
      const data: FmpSectorPerf[] = await res.json();
      const today = new Date().toISOString().split('T')[0];

      if (Array.isArray(data)) {
        for (const item of data) {
          const returnVal = parseFloat(item.changesPercentage.replace('%', ''));
          
          const { error } = await supabaseAdmin
            .from('sector_performance')
            .upsert({
              sector: item.sector,
              window_code: '1D',
              performance_date: today,
              return_percent: returnVal,
              source: 'fmp_sectors_performance'
            }, { onConflict: 'sector,window_code,performance_date' });

          if (error) {
            console.error(`Error upserting 1D for ${item.sector}:`, error);
            results.errors.push(`Upsert 1D ${item.sector}: ${error.message}`);
          } else {
            results.processed++;
          }
        }
      } else {
          console.error('Unexpected response format for sector performance');
          results.errors.push('Realtime: Unexpected format');
      }
    }
  } catch (err: any) {
    console.error('Failed to fetch realtime sector performance:', err);
    results.errors.push(`Realtime: ${err.message}`);
  }

  // 2. Fetch Historical (Historical Sectors Performance)
  try {
    const url = `${FMP_BASE_URL}/historical-sectors-performance?limit=2000&apikey=${API_KEY}`;
    console.log(`Fetching Historical: ${url}`);
    const res = await fetch(url);
    
    if (res.status === 403) {
        console.warn('FMP Historical Sectors Performance endpoint is 403 Forbidden (Legacy). Skipping Historical update.');
        results.errors.push('Historical: 403 Forbidden (Legacy)');
    } else if (!res.ok) {
        console.error(`FMP API Error (Historical): ${res.status} ${res.statusText}`);
        results.errors.push(`Historical: ${res.status}`);
    } else {
        const data = await res.json();
        // Note: Without a valid response example and with the endpoint likely blocked, 
        // we defer implementation of the historical window mapping (1W, 1M, YTD, etc.)
        // to when a valid endpoint is confirmed.
        console.log('Historical data fetched (length):', Array.isArray(data) ? data.length : 'Not array');
    }

  } catch (err: any) {
     console.error('Failed to fetch historical sector performance:', err);
     results.errors.push(`Historical: ${err.message}`);
  }

  return results;
}

