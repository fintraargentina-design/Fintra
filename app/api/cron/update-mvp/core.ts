import { supabaseAdmin } from '@/lib/supabase-admin';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { fmpGet } from '@/lib/fmp/server';
import { normalizeProfileStructural } from '../fmp-bulk/normalizeProfileStructural';
import { calculateMarketPosition } from '@/lib/engine/market-position';

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

const ENGINE_VERSION = 'fintra-engine@2.0.0';

export async function runUpdateMvp(targetTicker?: string) {
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseKey) {
    throw new Error('Faltan API Keys (SUPABASE_SERVICE_ROLE_KEY)');
  }
  const supabase = supabaseAdmin;

  const today = new Date().toISOString().slice(0, 10);
  const results = { success: [] as string[], failed: [] as string[] };
  
  let tickersToProcess = WATCHLIST_MVP;
  if (targetTicker) {
      console.log(`🧪 DEBUG MODE: Processing only ${targetTicker}`);
      tickersToProcess = [targetTicker];
  }

  console.log(`🚀 [CRON] Iniciando análisis BULK para ${tickersToProcess.length} acciones...`);

  // Procesamos en chunks para no saturar URL length ni memoria
  const CHUNK_SIZE = 40;
  
  for (let i = 0; i < tickersToProcess.length; i += CHUNK_SIZE) {
    const chunk = tickersToProcess.slice(i, i + CHUNK_SIZE);
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
          // Pass null for confidenceInputs to use defaults (MVP mode)
          const analysis = await calculateFGOSFromData(symbol, profile, ratio, metric, growth, null, quote, today);

          if (!analysis) {
            results.failed.push(`${symbol} (Calc Error)`);
            continue;
          }

          // Traducción de Sector
          const rawSector = profile.sector || 'Unknown';
          const sectorSpanish = SECTOR_TRANSLATIONS[rawSector] || rawSector;

          const structural = normalizeProfileStructural(profile, ratio, metric, { source: 'on_demand', last_updated: new Date().toISOString() });

          // Calculate Market Position
          const marketPosition = await calculateMarketPosition(
            symbol,
            rawSector,
            {
              marketCap: profile.marketCap,
              roic: ratio?.returnOnInvestedCapitalTTM,
              operatingMargin: ratio?.operatingProfitMarginTTM,
              revenueGrowth: growth?.revenueGrowth
            },
            today
          );

          // Build market_snapshot (Required by schema)
          const marketSnapshot = {
            price: quote?.price ?? profile?.price ?? null,
            market_cap: profile?.marketCap ?? null,
            volume: quote?.volume ?? null,
            pe: ratio?.peRatioTTM ?? null,
            ps: ratio?.priceToSalesRatioTTM ?? null,
            pb: ratio?.priceToBookRatioTTM ?? null,
            div_yield: ratio?.dividendYielPercentageTTM ?? null,
            beta: profile?.beta ?? null,
            last_updated: new Date().toISOString()
          };

          // Preparar Payload
          upsertData.push({
            ticker: symbol,
            snapshot_date: today,
            engine_version: ENGINE_VERSION,
            profile_structural: structural,
            market_snapshot: marketSnapshot,
            market_position: marketPosition,
            fgos_score: analysis.fgos_score,
            fgos_components: analysis.fgos_breakdown,
            valuation: {
                valuation_status: (analysis as any).valuation_status,
                valuation_score: (analysis as any).valuation_score || (analysis as any).score || 0
            },
            investment_verdict: {
                reason: (analysis as any).valuation_status,
                summary: (analysis as any).valuation_status
            },
            data_confidence: {
                has_profile: !!profile,
                has_financials: !!ratio && !!metric,
                has_valuation: !!ratio,
                has_performance: !!quote,
                has_fgos: !!analysis
            },
            sector: sectorSpanish
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
          .upsert(upsertData, { onConflict: 'ticker, snapshot_date, engine_version' });

        if (error) throw error;
        console.log(`✅ Chunk guardado: ${upsertData.length} records.`);
      }

    } catch (chunkErr) {
      console.error(`❌ Error en chunk ${i}:`, chunkErr);
    }
  }

  return {
    message: "Cron Bulk finalizado",
    stats: {
      total: tickersToProcess.length,
      success: results.success.length,
      failed: results.failed.length
    },
    details: results
  };
}
