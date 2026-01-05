import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { calculateFGOSFromData } from '@/lib/engine/fintra-brain';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

// ENDPOINTS CSV (STABLE)
const FMP_CSV_URLS = {
  profiles: 'https://financialmodelingprep.com/stable/profile-bulk?part=0',
  ratios: 'https://financialmodelingprep.com/stable/ratios-ttm-bulk?part=0',
  metrics: 'https://financialmodelingprep.com/stable/key-metrics-ttm-bulk?part=0',
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
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);
    const csvText = await res.text();
    
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (h) => h.trim()
    });
    return parsed.data as any[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '1000');
  const offset = parseInt(searchParams.get('offset') || '0');
  const fmpKey = process.env.FMP_API_KEY!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  if (!fmpKey || !supabaseKey) return NextResponse.json({ error: 'Missing Keys' }, { status: 500 });

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    console.log("🚀 Iniciando BULK CSV Fetch...");
    const tStart = performance.now();

    const [rawProfiles, rawRatios, rawMetrics] = await Promise.all([
        fetchAndParseCSV(FMP_CSV_URLS.profiles, fmpKey),
        fetchAndParseCSV(FMP_CSV_URLS.ratios, fmpKey),
        fetchAndParseCSV(FMP_CSV_URLS.metrics, fmpKey)
    ]);

    const getSym = (obj: any) => obj.symbol || obj.Symbol;

    const ratiosMap = new Map(rawRatios.map(r => [getSym(r), r]));
    const metricsMap = new Map(rawMetrics.map(m => [getSym(m), m]));
    
    const allValidProfiles = rawProfiles.filter(p => {
        const price = p.price || p.Price;
        const sector = p.sector || p.Sector;
        return price > 0 && sector && sector !== 'N/A';
    });

    const batchToProcess = allValidProfiles.slice(offset, offset + limit);
    console.log(`⚙️ Procesando lote: del ${offset} al ${offset + limit} (${batchToProcess.length} empresas)...`);
    
    const snapshotsToUpsert = [];

    for (const profile of batchToProcess) {
      const sym = getSym(profile);
      const ratios = ratiosMap.get(sym) || {};
      const metrics = metricsMap.get(sym) || {};
      
      const fgos = calculateFGOSFromData(
        sym,
        profile,
        ratios,
        metrics,
        {}, // Growth vacío en bulk
        { price: profile.price || profile.Price } 
      );

      if (fgos) {
         const rawSector = profile.sector || profile.Sector || 'Unknown';
         const sectorEs = SECTOR_TRANSLATIONS[rawSector] || rawSector;
         
         const pe = ratios.peRatioTTM || ratios.peRatio || 0;

         snapshotsToUpsert.push({
            ticker: sym,
            date: new Date().toISOString().slice(0, 10),
            
            // FGOS (Calidad)
            fgos_score: fgos.fgos_score,
            fgos_breakdown: fgos.fgos_breakdown,
            
            // VALUACIÓN (Nuevo Termómetro)
            valuation_status: fgos.valuation_status,
            valuation_score: fgos.valuation_score || 0, // Usamos el nuevo campo explícito
            verdict_text: fgos.valuation_status,
            
            sector: sectorEs,
            pe_ratio: pe,
            calculated_at: new Date().toISOString()
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