import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { fmpGet } from '@/lib/fmp/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

// --- MAPA DE TRADUCCIÓN DE SECTORES ---
const SECTOR_TRANSLATIONS: Record<string, string> = {
  'Technology': 'Tecnología',
  'Communication Services': 'Comunicación',
  'Consumer Cyclical': 'Consumo Discrecional',
  'Consumer Defensive': 'Consumo Masivo',
  'Financial Services': 'Finanzas',
  'Healthcare': 'Salud',
  'Industrials': 'Industria',
  'Energy': 'Energía',
  'Basic Materials': 'Materiales',
  'Real Estate': 'Inmobiliario',
  'Utilities': 'Servicios Públicos',
  'Conglomerates': 'Conglomerados',
  'Unknown': 'Desconocido'
};

// LISTA TOP 10 LÍDERES POR SECTOR (GICS) - Total 110 Tickers
const WATCHLIST_MVP = [
  'AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'ADBE', 
  'GOOGL', 'META', 'NFLX', 'DIS', 'CMCSA', 'TMUS', 'VZ', 
  'AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'LOW', 
  'WMT', 'PG', 'KO', 'PEP', 'COST', 'PM', 'MO', 
  'JPM', 'BAC', 'V', 'MA', 'BRKC', 'GS', 'MS', 
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO', 
  'CAT', 'GE', 'HON', 'UNP', 'UPS', 'BA', 'DE', 
  'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY', 'MPC', 
  'LIN', 'SHW', 'FCX', 'SCCO', 'NEM', 'DOW', 'APD', 
  'PLD', 'AMT', 'EQIX', 'CCI', 'O', 'SPG', 'PSA', 
  'NEE', 'SO', 'DUK', 'SRE', 'AEP', 'D', 'PEG', 
];

// Helper para obtener datos en Bulk
async function fetchBulkData(tickers: string[]) {
  const tickerStr = tickers.join(',');
  
  // Ejecutamos peticiones en paralelo
  // Nota: Usamos las rutas directas de API v3 que soportan bulk por coma
  const [profiles, ratios, metrics, growths, quotes] = await Promise.all([
    fmpGet<any[]>(`/api/v3/profile/${tickerStr}`),
    fmpGet<any[]>(`/api/v3/ratios-ttm/${tickerStr}`),
    fmpGet<any[]>(`/api/v3/key-metrics-ttm/${tickerStr}`),
    fmpGet<any[]>(`/api/v3/financial-growth/${tickerStr}?limit=1`), // Limit 1 para obtener el último anual
    fmpGet<any[]>(`/api/v3/quote/${tickerStr}`)
  ]);

  return { 
    profiles: profiles || [], 
    ratios: ratios || [], 
    metrics: metrics || [], 
    growths: growths || [], 
    quotes: quotes || [] 
  };
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!; 
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseKey) {
    return NextResponse.json({ error: 'Faltan API Keys (SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  const today = new Date().toISOString().slice(0, 10);
  const results = { success: [] as string[], failed: [] as string[] };
  
  console.log(`🚀 [CRON] Iniciando análisis BULK para ${WATCHLIST_MVP.length} acciones...`);

  // Procesamos en chunks para no saturar URL length ni memoria
  const CHUNK_SIZE = 40;
  
  for (let i = 0; i < WATCHLIST_MVP.length; i += CHUNK_SIZE) {
    const chunk = WATCHLIST_MVP.slice(i, i + CHUNK_SIZE);
    console.log(`📦 Procesando chunk ${i / CHUNK_SIZE + 1}... (${chunk.length} tickers)`);

    try {
      // 1. Fetch Bulk Data
      const data = await fetchBulkData(chunk);

      // Creamos mapas para acceso rápido O(1)
      const profilesMap = new Map(data.profiles.map((p: any) => [p.symbol, p]));
      const ratiosMap = new Map(data.ratios.map((r: any) => [r.symbol, r]));
      const metricsMap = new Map(data.metrics.map((m: any) => [m.symbol, m]));
      const growthsMap = new Map(data.growths.map((g: any) => [g.symbol, g]));
      const quotesMap = new Map(data.quotes.map((q: any) => [q.symbol, q]));

      // 2. Procesar cada ticker en memoria
      const upsertData = [];

      for (const symbol of chunk) {
        try {
          const profile = profilesMap.get(symbol);
          const ratio = ratiosMap.get(symbol);
          const metric = metricsMap.get(symbol);
          const growth = growthsMap.get(symbol);
          const quote = quotesMap.get(symbol);

          // Si falta el perfil, difícilmente podemos calcular sector/fgos correctamente
          if (!profile) {
            console.warn(`[CRON] Missing profile for ${symbol}`);
            results.failed.push(symbol);
            continue;
          }

          // Cálculo Puro (CPU bound, muy rápido)
          const analysis = calculateFGOSFromData(symbol, profile, ratio, metric, growth, quote);

          if (!analysis) {
            results.failed.push(`${symbol} (Calc Error)`);
            continue;
          }

          // Traducción de Sector
          const rawSector = profile.sector || 'Unknown';
          const sectorSpanish = SECTOR_TRANSLATIONS[rawSector] || rawSector;

          // Preparar Payload
          upsertData.push({
            ticker: symbol,
            date: today,
            fgos_score: analysis.fgos_score,
            fgos_breakdown: analysis.fgos_breakdown,
            valuation_status: analysis.valuation_status,
            valuation_score: analysis.score || 0,
            verdict_text: analysis.valuation_status,
            sector: sectorSpanish,
            pe_ratio: 0,
            calculated_at: new Date().toISOString()
          });
          
          results.success.push(symbol);

        } catch (innerErr) {
          console.error(`Error procesando ${symbol}:`, innerErr);
          results.failed.push(symbol);
        }
      }

      // 3. Bulk Upsert a Supabase
      if (upsertData.length > 0) {
        const { error } = await supabase
          .from('fintra_snapshots')
          .upsert(upsertData, { onConflict: 'ticker, date' });

        if (error) throw error;
        console.log(`✅ Chunk guardado: ${upsertData.length} records.`);
      }

    } catch (chunkErr) {
      console.error(`❌ Error en chunk ${i}:`, chunkErr);
    }
  }

  return NextResponse.json({
    message: "Cron Bulk finalizado",
    stats: {
      total: WATCHLIST_MVP.length,
      success: results.success.length,
      failed: results.failed.length
    },
    details: results
  });
}
