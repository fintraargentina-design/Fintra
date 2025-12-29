import { supabase } from '@/lib/supabase';
import { FintraSnapshotDB, EcosystemRelationDB } from '@/lib/engine/types';

/**
 * Obtiene la última snapshot de análisis Fintra para un símbolo.
 */
export async function getLatestSnapshot(symbol: string): Promise<FintraSnapshotDB | null> {
  console.log(`[getLatestSnapshot] Fetching for ticker: ${symbol}`);
  // Explicitly select columns to avoid any ambiguity or cached schema issues
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('id, ticker, fgos_score, ecosystem_score, valuation_status, valuation_score, verdict_text, calculated_at, fgos_breakdown')
    .eq('ticker', symbol)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle(); // Use maybeSingle to avoid error if no rows found

  if (error) {
    console.error(`Error fetching snapshot for ${symbol}:`, error);
    return null;
  }

  if (!data) return null;

  // Map DB fields to FintraSnapshotDB interface
  return {
    symbol: data.ticker,
    date: data.calculated_at,
    fgos_score: data.fgos_score,
    valuation_score: data.valuation_score ?? 50, // Use DB value or default
    ecosystem_health_score: data.ecosystem_score,
    verdict_text: data.verdict_text ?? "N/A", // Use DB value or default
    valuation_status: data.valuation_status,
    sector: "",
    fgos_breakdown: data.fgos_breakdown // Include breakdown data
  } as FintraSnapshotDB;
}

/**
 * Obtiene el detalle del ecosistema enriquecido con scores de los partners.
 */
export async function getEcosystemDetailed(symbol: string): Promise<{ suppliers: EcosystemRelationDB[], clients: EcosystemRelationDB[] }> {
  // 1. Obtener relaciones
  const { data: relations, error: relError } = await supabase
    .from('fintra_ecosystem_relations')
    .select('*')
    .eq('symbol', symbol);

  if (relError || !relations) {
    console.error(`Error fetching ecosystem relations for ${symbol}:`, relError);
    return { suppliers: [], clients: [] };
  }

  // 2. Obtener partner symbols
  const partnerSymbols = relations.map((r: any) => r.partner_symbol).filter(Boolean);

  if (partnerSymbols.length === 0) {
    return {
      suppliers: relations.filter((r: any) => r.relation_type === 'SUPPLIER') as EcosystemRelationDB[],
      clients: relations.filter((r: any) => r.relation_type === 'CLIENT') as EcosystemRelationDB[]
    };
  }

  // 3. Obtener snapshots de los partners para enriquecer
  // Nota: Buscamos la snapshot más reciente para cada partner. 
  // Esta query simplificada trae todas las snapshots de los partners. 
  // En producción idealmente haríamos un distinct on (symbol) order by date desc.
  const { data: snapshots, error: snapError } = await supabase
    .from('fintra_snapshots')
    .select('ticker, fgos_score, valuation_status, ecosystem_score')
    .in('ticker', partnerSymbols)
    .order('calculated_at', { ascending: false });

  if (snapError) {
    console.error('Error fetching partner snapshots:', snapError);
    // Retornar relaciones sin enriquecer si falla esto
  }

  // Mapa de snapshots más recientes por símbolo
  const snapshotMap = new Map<string, any>();
  if (snapshots) {
    snapshots.forEach((snap: any) => {
      if (!snapshotMap.has(snap.ticker)) {
        snapshotMap.set(snap.ticker, snap);
      }
    });
  }

  // 4. Enriquecer relaciones
  const enrichedRelations: EcosystemRelationDB[] = relations.map((rel: any) => {
    const snap = snapshotMap.get(rel.partner_symbol);
    return {
      ...rel,
      partner_fgos: snap?.fgos_score,
      partner_valuation: 50, // Default
      partner_ehs: snap?.ecosystem_score,
      partner_verdict: "N/A" // Default
    };
  });

  // 5. Agrupar por tipo
  return {
    suppliers: enrichedRelations.filter(r => r.relation_type === 'SUPPLIER'),
    clients: enrichedRelations.filter(r => r.relation_type === 'CLIENT')
  };
}

/**
 * Obtiene un screener de empresas del mismo sector ordenadas por FGOS.
 */
export async function getSectorScreener(sector: string): Promise<FintraSnapshotDB[]> {
  // TODO: La columna 'sector' no existe actualmente en fintra_snapshots.
  // Retornamos array vacío para evitar errores hasta que se actualice la DB.
  console.warn(`[getSectorScreener] Skipping sector fetch for ${sector} as DB column is missing.`);
  return [];
  
  /* 
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('*')
    .eq('sector', sector)
    .order('fgos_score', { ascending: false })
    .limit(20);

  if (error) {
    console.error(`Error fetching sector screener for ${sector}:`, error);
    return [];
  }

  return data as FintraSnapshotDB[];
  */
}
