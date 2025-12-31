import { supabase } from '@/lib/supabase';
import { FintraSnapshotDB, EcosystemRelationDB, EcosystemDataJSON, EcoNodeJSON, EcosystemReportDB } from '@/lib/engine/types';

/**
 * Obtiene la última snapshot de análisis Fintra para un símbolo.
 */
export async function getLatestSnapshot(symbol: string): Promise<FintraSnapshotDB | null> {
  console.log(`[getLatestSnapshot] Fetching for ticker: ${symbol}`);
  // Incluimos las nuevas columnas JSONB en la selección
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('id, ticker, fgos_score, valuation_status, valuation_score, verdict_text, calculated_at, fgos_breakdown')
    .eq('ticker', symbol)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching snapshot for ${symbol}:`, error);
    return null;
  }

  if (!data) return null;

  return {
    ticker: data.ticker,
    date: data.calculated_at,
    fgos_score: data.fgos_score,
    fgos_breakdown: data.fgos_breakdown,
    // ecosystem_score removed as it is now in fintra_ecosystem_reports
    valuation_score: data.valuation_score ?? 50,
    valuation_status: data.valuation_status,
    verdict_text: data.verdict_text ?? "N/A"
  } as FintraSnapshotDB;
}

/**
 * Obtiene el último reporte de ecosistema para un ticker.
 */
export async function getLatestEcosystemReport(ticker: string): Promise<EcosystemReportDB | null> {
  const { data, error } = await supabase
    .from('fintra_ecosystem_reports')
    .select('*')
    .eq('ticker', ticker)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching ecosystem report for ${ticker}:`, error);
    return null;
  }

  if (!data) return null;

  return data as EcosystemReportDB;
}

/**
 * Guarda o actualiza el análisis del ecosistema en la nueva tabla fintra_ecosystem_reports.
 */
export async function saveEcosystemReport(data: {
  mainTicker: string;
  suppliers: EcoNodeJSON[];
  clients: EcoNodeJSON[];
  report: string;
}) {
  const { mainTicker, suppliers, clients, report } = data;

  // Helper para calcular promedio EHS
  const calculateAverageEHS = (nodes: EcoNodeJSON[]) => {
    if (!nodes.length) return 50;
    const sum = nodes.reduce((acc, curr) => acc + (curr.ehs || 50), 0);
    return Math.round(sum / nodes.length);
  };

  const ecosystemScore = calculateAverageEHS([...suppliers, ...clients]);
  const ecosystemData: EcosystemDataJSON = { suppliers, clients };
  const today = new Date().toISOString().split('T')[0];

  const payload = {
    ticker: mainTicker,
    date: today,
    data: ecosystemData,
    ecosystem_score: ecosystemScore,
    report_md: report
  };

  const { error } = await supabase
    .from('fintra_ecosystem_reports')
    .upsert(payload, { onConflict: 'ticker, date', ignoreDuplicates: false })
    .select();

  if (error) {
    console.error('[saveEcosystemReport] Error saving to DB:', error);
    throw new Error(error.message);
  }

  return { success: true, ticker: mainTicker, score: ecosystemScore };
}

/**
 * Obtiene la lista de sectores disponibles en fintra_snapshots.
 */
export async function getAvailableSectors(): Promise<string[]> {
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('sector');

  if (error) {
    console.error('Error fetching sectors:', error);
    return [];
  }

  // Filtrar nulos y obtener únicos
  const sectors = Array.from(new Set(data.map((item: any) => item.sector)))
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .sort();
    
  return sectors;
}

/**
 * Obtiene los tickers asociados a un sector específico desde fintra_snapshots.
 */
export async function getTickersBySector(sector: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('fintra_snapshots')
    .select('ticker')
    .eq('sector', sector);

  if (error) {
    console.error(`Error fetching tickers for sector ${sector}:`, error);
    return [];
  }

  // Filtrar nulos y duplicados
  const tickers = Array.from(new Set(data.map((item: any) => item.ticker)))
    .filter((t): t is string => typeof t === 'string' && t.length > 0);
    
  return tickers;
}

/**
 * Obtiene el detalle del ecosistema (Ahora soporta modo Legacy Relacional y Nuevo JSONB).
 * Prioriza el uso de JSONB si existe en la snapshot.
 */
export async function getEcosystemDetailed(symbol: string): Promise<{ suppliers: any[], clients: any[] }> {
  
  // 1. Intentar obtener desde fintra_ecosystem_reports (Nueva fuente de verdad)
  const report = await getLatestEcosystemReport(symbol);
  
  if (report?.data) {
    // Si tenemos datos JSONB, los devolvemos directamente
    return {
      suppliers: report.data.suppliers || [],
      clients: report.data.clients || []
    };
  }

  // 2. Fallback: Modelo Relacional Legacy (Si no hay reporte nuevo)
  console.log(`[getEcosystemDetailed] No ecosystem report for ${symbol}, falling back to legacy relational fetch.`);
  
  const { data: relations, error: relError } = await supabase
    .from('fintra_ecosystem_relations')
    .select('*')
    .eq('symbol', symbol);

  if (relError || !relations) {
    return { suppliers: [], clients: [] };
  }
  
  return {
    suppliers: relations.filter((r: any) => r.relation_type === 'SUPPLIER'),
    clients: relations.filter((r: any) => r.relation_type === 'CLIENT')
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
