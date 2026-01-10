import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import { getActiveStockTickers } from '@/lib/repository/active-stocks';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

// ENDPOINTS CSV (STABLE)
const FMP_CSV_URLS = {
  profiles: 'https://financialmodelingprep.com/stable/profile-bulk?part=0',
  ratios: 'https://financialmodelingprep.com/stable/ratios-ttm-bulk?part=0',
  metrics: 'https://financialmodelingprep.com/stable/key-metrics-ttm-bulk?part=0',
  quotes: 'https://financialmodelingprep.com/stable/quote-bulk?part=0',
  // Endpoint correcto según documentación FMP
  price_change: 'https://financialmodelingprep.com/stable/stock-price-change?part=0', 
};

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
  'Conglomerates': 'Conglomerados'
};

async function fetchAndParseCSV(url: string, apiKey: string) {
    const res = await fetch(`${url}&apikey=${apiKey}`);
    if (!res.ok) {
        const errorText = await res.text().catch(() => 'No error text');
        throw new Error(`Failed to fetch ${url} - Status: ${res.status} - ${errorText}`);
    }
    const csvText = await res.text();
    
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (h: string) => h.trim()
    });
    return parsed.data as any[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam) : null;
  const offset = parseInt(searchParams.get('offset') || '0');
  const fmpKey = process.env.FMP_API_KEY!;
  if (!fmpKey) return NextResponse.json({ error: 'Missing Keys' }, { status: 500 });

  const supabase = supabaseAdmin;

  try {
    console.log("🚀 Iniciando BULK CSV Fetch...");
    const tStart = performance.now();

    const results = await Promise.allSettled([
        fetchAndParseCSV(FMP_CSV_URLS.profiles, fmpKey),
        fetchAndParseCSV(FMP_CSV_URLS.ratios, fmpKey),
        fetchAndParseCSV(FMP_CSV_URLS.metrics, fmpKey),
        fetchAndParseCSV(FMP_CSV_URLS.quotes, fmpKey),
        fetchAndParseCSV(FMP_CSV_URLS.price_change, fmpKey)
    ]);

    // Verificar si falló profiles (crítico)
    if (results[0].status === 'rejected') {
        throw new Error(`Critical: Profiles fetch failed - ${results[0].reason}`);
    }

    const rawProfiles = results[0].value;
    const rawRatios = results[1].status === 'fulfilled' ? results[1].value : [];
    const rawMetrics = results[2].status === 'fulfilled' ? results[2].value : [];
    const rawQuotes = results[3].status === 'fulfilled' ? results[3].value : [];
    const rawPriceChange = results[4].status === 'fulfilled' ? results[4].value : [];

    // Log de errores no críticos
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.warn(`Warning: Fetch ${Object.keys(FMP_CSV_URLS)[i]} failed - ${r.reason}`);
        }
    });

    const getSym = (obj: any) => obj.symbol || obj.Symbol;

    const ratiosMap = new Map(rawRatios.map(r => [getSym(r), r]));
    const metricsMap = new Map(rawMetrics.map(m => [getSym(m), m]));
    const quotesMap = new Map(rawQuotes.map(q => [getSym(q), q]));
    const priceChangeMap = new Map(rawPriceChange.map(p => [getSym(p), p]));
    
    // FILTER: Only Active Stocks (Equities)
    const activeTickers = new Set(await getActiveStockTickers(supabase));

    const allValidProfiles = rawProfiles.filter(p => {
        const sym = getSym(p);
        if (!activeTickers.has(sym)) return false;

        const price = p.price || p.Price;
        const sector = p.sector || p.Sector;
        return price > 0 && sector && sector !== 'N/A';
    });

    const batchToProcess = limit 
      ? allValidProfiles.slice(offset, offset + limit)
      : allValidProfiles.slice(offset);
    
    console.log(`⚙️ Procesando lote: del ${offset} al ${limit ? offset + limit : 'END'} (${batchToProcess.length} empresas)...`);
    
    const today = new Date().toISOString().slice(0, 10);
    const snapshotsToUpsert = [];

    for (const profile of batchToProcess) {
      const sym = getSym(profile);
      const ratios = ratiosMap.get(sym) || {};
      const metrics = metricsMap.get(sym) || {};
      const quote = quotesMap.get(sym) || {};
      const priceChange = priceChangeMap.get(sym) || {};
      
      const fgos = await calculateFGOSFromData(
        sym,
        profile,
        ratios,
        metrics,
        {}, // Growth vacío en bulk
        { price: profile.price || profile.Price },
        today
      );

      if (fgos) {
         const rawSector = profile.sector || profile.Sector || 'Unknown';
         const sectorEs = SECTOR_TRANSLATIONS[rawSector] || rawSector;
         
         const pe = ratios.peRatioTTM || ratios.peRatio || 0;

         // Construir profile_ticker (JSONB)
         const profileTicker = {
            // Identidad
            companyName: profile.companyName || profile.name,
            sector: rawSector,
            industry: profile.industry,
            exchange: profile.exchange || profile.exchangeShortName,
            description: profile.description,
            ceo: profile.ceo,
            website: profile.website,
            country: profile.country,
            image: profile.image || profile.logo,
            currency: profile.currency,
            isin: profile.isin,
            cusip: profile.cusip,
            cik: profile.cik,

            // Contacto y Detalles
            fullTimeEmployees: profile.fullTimeEmployees,
            ipoDate: profile.ipoDate,
            phone: profile.phone,
            address: profile.address,
            city: profile.city,
            state: profile.state,
            zip: profile.zip,
            isEtf: profile.isEtf,
            isActivelyTrading: profile.isActivelyTrading,

            // Métricas de Mercado (Quote/Profile)
            price: quote.price || profile.price || profile.Price,
            marketCap: quote.marketCap || profile.mktCap,
            change: quote.change,
            changePercentage: quote.changesPercentage,
            beta: profile.beta,
            lastDividend: profile.lastDiv,
            volume: quote.volume,
            averageVolume: quote.avgVolume || profile.volAvg,
            range: profile.range,
         };

         // Valores nuevos
         const lastPrice = quote.price || profile.price || profile.Price || 0;
         const marketCap = quote.marketCap || profile.mktCap || 0;
         const divYield = metrics.dividendYield || ratios.dividendYieldTTM || ratios.dividendYield || 0;
         const ytdPercent = priceChange['ytd'] || 0;
         const estimacion = profile.dcf || 0; // Usando DCF como estimación disponible en bulk profile

         snapshotsToUpsert.push({
            ticker: sym,
            date: new Date().toISOString().slice(0, 10),
            
            // FGOS (Calidad)
            fgos_score: fgos.fgos_score,
            fgos_breakdown: fgos.fgos_breakdown,
            
            // VALUACIÓN (Nuevo Termómetro)
            valuation_status: (fgos as any).valuation_status,
            valuation_score: (fgos as any).valuation_score || 0,
            verdict_text: (fgos as any).valuation_status,
            investment_verdict: (fgos as any).investment_verdict,
            
            sector: sectorEs,
            // pe: pe, // Campo 'pe' no existe en schema, usamos pe_ratio
            pe_ratio: pe,
            sector_pe_ratio: (fgos as any).sector_pe || 0,
            calculated_at: new Date().toISOString(),

            // NUEVOS CAMPOS SOLICITADOS
            profile_ticker: profileTicker,
            div_yield: divYield,
            estimacion: estimacion,
            last_price: lastPrice,
            ytd_percent: ytdPercent,
            market_cap: marketCap
         });
      }
    }

    const CHUNK_SIZE = 100;
    let insertedCount = 0;
    for (let i = 0; i < snapshotsToUpsert.length; i += CHUNK_SIZE) {
        const chunk = snapshotsToUpsert.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase
            .from('fintra_snapshots')
            .upsert(chunk, { onConflict: 'ticker, date' });
        
        if (error) console.error(`Error chunk ${i}:`, error.message);
        else insertedCount += chunk.length;
    }

    const tEnd = performance.now();
    return NextResponse.json({
      success: true,
      processed: batchToProcess.length,
      inserted: insertedCount,
      next_offset: offset + batchToProcess.length,
      time_ms: Math.round(tEnd - tStart),
      mode: "CSV Bulk"
    });

  } catch (e: any) {
    console.error("CSV Bulk Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
