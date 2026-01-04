import { getLatestEcosystemReport, saveEcosystemReport } from '@/lib/repository/fintra-db';
import { isDataStale } from '@/lib/utils';
import { EcoNodeJSON, EcosystemDataJSON } from '@/lib/engine/types';

import { fmpGet } from '@/lib/fmp/server';
import { ProfileResponse } from '@/lib/fmp/types';

// Definir la interfaz de respuesta del servicio
export interface EcosystemServiceResponse {
  source: 'cache' | 'fresh';
  data: EcosystemDataJSON;
  score: number;
  report: string;
  lastUpdated: string;
}

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_ECOSYSTEM_URL || process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;

export async function getOrAnalysisEcosystem(ticker: string, forceRefresh: boolean = false): Promise<EcosystemServiceResponse> {
  if (!ticker) throw new Error("Ticker is required");

  // 1. CONSULTA DB: Llama a getLatestEcosystemReport (NUEVA TABLA)
  const reportDB = await getLatestEcosystemReport(ticker);

  // 2. VALIDACIÓN
  // ¿Existe el reporte?
  // ¿Tiene data (suppliers o clients)?
  const hasData = reportDB?.data && 
                  (reportDB.data.suppliers?.length > 0 || reportDB.data.clients?.length > 0);
  
  // ¿La fecha tiene menos de 30 días de antigüedad?
  const isFresh = !isDataStale(reportDB?.date, 30);

  // 3. CAMINO RÁPIDO (Cache Hit)
  // Si NO se fuerza refresh y hay datos frescos, devolver cache
  if (!forceRefresh && reportDB && hasData && isFresh) {
    console.log(`[EcosystemService] Cache HIT for ${ticker}`);
    return {
      source: 'cache',
      data: reportDB.data,
      score: reportDB.ecosystem_score || 50,
      report: reportDB.report_md || "",
      lastUpdated: reportDB.date || new Date().toISOString()
    };
  }

  // 4. CAMINO LENTO (Cache Miss/Stale/Forced)
  console.log(`[EcosystemService] Cache MISS/STALE/FORCED for ${ticker}. Fetching from n8n...`);
  
  if (!N8N_WEBHOOK_URL) {
    throw new Error("N8N_WEBHOOK_URL is not defined in environment variables");
  }

  try {
    // Obtener exchange y datos extendidos desde FMP
     let exchange = "";
     let fmpData: any = {};
 
      try {
          // Usar fmpGet directo para evitar problemas de fetch interno en servidor
          const profiles = await fmpGet<ProfileResponse>(`/v3/profile/${ticker}`);
          
          if (profiles && profiles.length > 0) {
              const p = profiles[0];
             exchange = p.exchangeShortName || p.exchange || "";

             // Calcular Market Cap Bucket
             const mktCap = p.mktCap || 0;
             let bucket = "micro_cap"; // Default < 300M
             if (mktCap >= 200_000_000_000) bucket = "mega_cap";
             else if (mktCap >= 10_000_000_000) bucket = "large_cap";
             else if (mktCap >= 2_000_000_000) bucket = "mid_cap";
             else if (mktCap >= 300_000_000) bucket = "small_cap";

             fmpData = {
                 company_name: p.companyName,
                 sector: p.sector,
                 industry: p.industry,
                 market_cap_bucket: bucket,
                 country: p.country,
                 description: p.description,
                 website: p.website,
                 ceo: p.ceo,
                 full_time_employees: p.fullTimeEmployees
             };
         }
     } catch (err) {
         console.warn(`[EcosystemService] Failed to fetch profile for ${ticker}`, err);
     }

     // Llama al Webhook de n8n
    const payloadData = { 
        ticker: ticker, 
        company_name: fmpData.company_name, 
        sector: fmpData.sector, 
        industry: fmpData.industry, 
        description: fmpData.description,
        ceo: fmpData.ceo,
        exchange: exchange,
        country: fmpData.country,
        force_refresh: forceRefresh
    };

    console.log("[EcosystemService] Sending to n8n:", JSON.stringify(payloadData, null, 2));

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadData),
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`n8n Webhook failed with status ${response.status}`);
    }

    const aiData = await response.json();
    
    // Recibe el JSON
    const payload = Array.isArray(aiData) ? aiData[0] : aiData;

    const cleanData = {
      mainTicker: payload.mainTicker || ticker,
      suppliers: (payload.suppliers || []) as EcoNodeJSON[],
      clients: (payload.clients || []) as EcoNodeJSON[],
      report: payload.report || ""
    };

    // Llama a saveEcosystemReport para guardar/actualizar en DB (NUEVA TABLA)
    const saveResult = await saveEcosystemReport(cleanData);

    // Devuelve los datos nuevos
    return {
      source: 'fresh',
      data: { suppliers: cleanData.suppliers, clients: cleanData.clients },
      score: saveResult.score,
      report: cleanData.report,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error(`[EcosystemService] Error refreshing data for ${ticker}:`, error);
    
    // Fallback: Si falla n8n pero tenemos datos viejos, devolvemos cache aunque sea stale
    if (reportDB && hasData) {
        console.warn(`[EcosystemService] Returning STALE data as fallback for ${ticker}`);
        return {
          source: 'cache', 
          data: reportDB.data,
          score: reportDB.ecosystem_score || 50,
          report: reportDB.report_md || "",
          lastUpdated: reportDB.date || new Date().toISOString()
        };
    }
    
    throw error;
  }
}
