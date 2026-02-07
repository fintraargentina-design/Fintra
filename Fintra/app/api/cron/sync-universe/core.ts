import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllFmpData } from '../fmp-bulk/fetchBulk';

const FMP_API_KEY = process.env.FMP_API_KEY;

if (!FMP_API_KEY) {
  throw new Error('Missing required env vars');
}
const supabase = supabaseAdmin;

const BATCH_SIZE = 1000;

export async function runSyncUniverse(targetTicker?: string, limit?: number) {
  try {
    console.log('🌍 Sync Fintra Universe (Profiles Bulk)');

    const today = new Date().toISOString().slice(0, 10);

    // 1️⃣ Descargar perfiles completos usando fetchAllFmpData
    // Esto maneja paginación (parts), cache y retries automáticamente.
    const result = await fetchAllFmpData('profiles', FMP_API_KEY!);

    if (!result.ok) {
        throw new Error(`Error descargando profiles: ${result.error?.message}`);
    }

    let rows = result.data; // Array of objects from CSV
    console.log(`📥 Perfiles recibidos: ${rows.length}`);

    // CLEANUP: Filter invalid symbols and Deduplicate
    // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    const uniqueRowsMap = new Map();
    for (const row of rows) {
        if (!row.symbol) continue; // Skip rows without symbol
        
        if (!uniqueRowsMap.has(row.symbol)) {
            uniqueRowsMap.set(row.symbol, row);
        }
    }
    rows = Array.from(uniqueRowsMap.values());
    console.log(`🧹 Perfiles únicos tras limpieza: ${rows.length}`);

    // FILTER if targetTicker
    if (targetTicker) {
        console.log(`🧪 DEBUG MODE: Filtering for ticker ${targetTicker}`);
        rows = rows.filter((p: any) => p.symbol === targetTicker);
        if (rows.length === 0) {
            console.warn(`⚠️ Ticker ${targetTicker} not found in profile bulk data.`);
        }
    }
    
    // LIMIT (Benchmark Mode)
    if (limit && limit > 0) {
        console.log(`🧪 BENCHMARK MODE: Limiting to first ${limit} rows`);
        rows = rows.slice(0, limit);
    }

    // 2️⃣ Procesar en batches (PARALELO)
    let processed = 0;
    
    // Preparar chunks
    const chunks: any[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      chunks.push(rows.slice(i, i + BATCH_SIZE));
    }

    console.log(`🚀 Iniciando inserción paralela de ${chunks.length} batches...`);

    // Procesar chunks en paralelo (Promise.all)
    // Supabase maneja el connection pool, pero si son demasiados chunks (>100)
    // podríamos saturar el ancho de banda o timeout. Con ~50-60 batches es seguro.
    await Promise.all(
        chunks.map(async (slice, idx) => {
            const dbRows = slice.map((p: any) => {
                const sector = p.sector || null;
                const industry = p.industry || null;
                const name = p.companyName || null;
                const ticker = p.symbol;
        
                // Determinar Instrument Type
                let instrument_type = 'EQUITY'; // Default
                const isEtf = String(p.isEtf).toLowerCase() === 'true';
                const isAdr = String(p.isAdr).toLowerCase() === 'true';
                const isFund = String(p.isFund).toLowerCase() === 'true';
                const exchangeShort = p.exchange || null; // e.g. "SAO", "CCC"
        
                if (isEtf) instrument_type = 'ETF';
                else if (isAdr) instrument_type = 'ADR';
                else if (isFund) instrument_type = 'FUND';
                else if (exchangeShort === 'CRYPTO' || exchangeShort === 'CCC') instrument_type = 'CRYPTO';
        
                // Confidence Logic
                let confidence = 0.0;
                if (ticker) {
                    if (name && sector && industry) {
                        confidence = 1.0;
                    } else if (name) {
                        confidence = 0.5;
                    }
                }
        
                return {
                    ticker: ticker,
                    name: name,
                    exchange: p.exchangeFullName || null, 
                    exchange_short: exchangeShort,       
                    currency: p.currency || null,
                    
                    // New Structural Fields
                    sector: sector,
                    industry: industry,
                    sub_industry: null, 
                    
                    instrument_type: instrument_type,
                    is_etf: isEtf,
                    is_adr: isAdr,
                    is_fund: isFund,
                    
                    country: p.country || null,
                    region: null,
                    
                    profile_confidence: confidence,
                    last_profile_update: today,
                    
                    // Standard Fields
                    is_active: true,
                    last_seen: today,
                    source: 'FMP'
                };
            });
        
            const { error } = await supabase
                .from('fintra_universe')
                .upsert(dbRows, { onConflict: 'ticker' });
        
            if (error) {
                console.error(`❌ Error en Batch ${idx + 1}:`, error.message);
                throw error;
            }
            
            processed += dbRows.length;
            if ((idx + 1) % 5 === 0) {
                 console.log(`✔ Batch ${idx + 1}/${chunks.length} completado`);
            }
        })
    );

    // 3️⃣ Marcar como inactivos los no vistos hoy
    // ONLY if NOT debugging a single ticker
    if (!targetTicker) {
        const { error: deactivateError } = await supabase.rpc('execute_sql', {
        sql: `
            update fintra_universe
            set is_active = false
            where source = 'FMP'
            and last_seen < '${today}';
        `
        });

        if (deactivateError) {
            console.warn('Warning: Failed to deactivate stale tickers', deactivateError);
        }
    } else {
        console.log(`🧪 DEBUG MODE: Skipping deactivation step to preserve other tickers.`);
    }

    console.log('✅ Fintra Universe sincronizado correctamente con Perfiles Completos');

    return {
      ok: true,
      total_symbols: rows.length,
      processed
    };
  } catch (err: any) {
    console.error('❌ Error en syncFintraUniverse', err);
    throw err;
  }
}
