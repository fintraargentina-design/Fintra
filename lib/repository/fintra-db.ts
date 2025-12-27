import { supabase } from '@/lib/supabase';
import { FintraSnapshotDB, EcosystemRelationDB } from '@/lib/engine/types';

/**
 * Obtiene la última snapshot de análisis Fintra para un símbolo.
 */
export async function getLatestSnapshot(symbol: string): Promise<FintraSnapshotDB | null> {
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('*')
    .eq('symbol', symbol)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error(`Error fetching snapshot for ${symbol}:`, error);
    return null;
  }

  return data as FintraSnapshotDB;
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
    .select('symbol, fgos_score, valuation_score, ecosystem_health_score, verdict_text')
    .in('symbol', partnerSymbols)
    .order('date', { ascending: false });

  if (snapError) {
    console.error('Error fetching partner snapshots:', snapError);
    // Retornar relaciones sin enriquecer si falla esto
  }

  // Mapa de snapshots más recientes por símbolo
  const snapshotMap = new Map<string, any>();
  if (snapshots) {
    snapshots.forEach((snap: any) => {
      if (!snapshotMap.has(snap.symbol)) {
        snapshotMap.set(snap.symbol, snap);
      }
    });
  }

  // 4. Enriquecer relaciones
  const enrichedRelations: EcosystemRelationDB[] = relations.map((rel: any) => {
    const snap = snapshotMap.get(rel.partner_symbol);
    return {
      ...rel,
      partner_fgos: snap?.fgos_score,
      partner_valuation: snap?.valuation_score,
      partner_ehs: snap?.ecosystem_health_score,
      partner_verdict: snap?.verdict_text
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
  // TODO: Asegurarse de que la columna 'sector' exista en la tabla fintra_snapshots.
  // Si no existe, se debe agregar o hacer un JOIN con la tabla de datos maestros de acciones.
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
}
