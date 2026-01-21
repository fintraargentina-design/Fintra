"use client";

import { useState, useEffect, useRef, use } from 'react';
import { StockEcosystem } from '@/lib/fmp/types';
import { StockData, StockAnalysis, StockPerformance, searchStockData } from '@/lib/stockQueries';
import { registerStockSearch } from '@/lib/supabase';
import { fmp } from '@/lib/fmp/client';
import { getLatestSnapshot, getEcosystemDetailed } from '@/lib/repository/fintra-db';
import { buildFGOSState } from '@/lib/engine/fgos-state';
import TickerExpandidoView from '@/components/dashboard/TickerExpandidoView';

interface PageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export default function ExpandedTickerPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  // Decode ticker from URL (e.g. %5EGSPC -> ^GSPC)
  const ticker = decodeURIComponent(unwrappedParams.ticker).toUpperCase();

  const [stockBasicData, setStockBasicData] = useState<StockData | null>(null);
  const [stockAnalysis, setStockAnalysis] = useState<StockAnalysis | null>(null);
  const [stockPerformance, setStockPerformance] = useState<StockPerformance | null>(null);
  const [stockEcosystem, setStockEcosystem] = useState<StockEcosystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  
  // Prop Drilling states
  const [stockRatios, setStockRatios] = useState<any>(null);
  const [stockMetrics, setStockMetrics] = useState<any>(null);

  const lastRequestedSymbolRef = useRef<string>('');

  const buscarDatosAccion = async (symbol: string) => {
    const sym = symbol?.trim().toUpperCase();
    if (!sym) return;
    
    lastRequestedSymbolRef.current = sym;
    
    setIsLoading(true);
    setError('');
    // Reset states
    setStockRatios(null);
    setStockMetrics(null);
    setStockBasicData(null);
    setStockAnalysis(null);
    setStockPerformance(null);
    setStockEcosystem(null);

    try {
      await registerStockSearch(sym);

      // Fetch Financial Data for Cards
      const [result, fundamentals] = await Promise.all([
        searchStockData(sym),
        // Fetch explicit Ratios and Metrics TTM
        Promise.all([
          fmp.ratiosTTM(sym).catch(err => { console.error("Ratios fetch error", err); return []; }),
          fmp.keyMetricsTTM(sym).catch(err => { console.error("Metrics fetch error", err); return []; })
        ])
      ]);

      // Check race condition
      if (lastRequestedSymbolRef.current !== sym) {
        console.log(`Ignoring result for ${sym} as user switched to ${lastRequestedSymbolRef.current}`);
        return;
      }

      // Process fundamentals
      const [ratiosData, metricsData] = fundamentals;
      setStockRatios(ratiosData?.[0] || null);
      setStockMetrics(metricsData?.[0] || null);

      if (result.success) {
        setStockBasicData(result.basicData || null);
        setStockAnalysis(result.analysisData || null);
        setStockPerformance(result.performanceData || null);

        // --- FINTRA DB INTEGRATION ---
        try {
          // 1. Get Latest Snapshot
          const snapshot = await getLatestSnapshot(sym);
          
          if (lastRequestedSymbolRef.current !== sym) return; 

          if (snapshot) {
             console.log("Fintra DB Snapshot found:", snapshot);
             
             // Build FGOS State
             const fgosState = buildFGOSState({
                 fgos_score: snapshot.fgos_score,
                 fgos_components: (snapshot as any).fgos_components || (snapshot as any).fgos_breakdown,
                 fgos_confidence_percent: snapshot.fgos_confidence_percent,
                 fgos_confidence_label: null, 
                 fgos_status: snapshot.fgos_status
             });

             setStockAnalysis((prev: any) => ({
                 ...prev,
                 fgos_score: snapshot.fgos_score,
                 fgos_status: snapshot.fgos_status,
                 fgos_confidence_percent: snapshot.fgos_confidence_percent,
                 valuation: snapshot.valuation,
                 fgos_breakdown: (snapshot as any).fgos_components || (snapshot as any).fgos_breakdown,
                 fgos_state: fgosState
             }));
          }

          // 2. Get Detailed Ecosystem
          const ecoData = await getEcosystemDetailed(sym);
          
          if (lastRequestedSymbolRef.current !== sym) return; 
          
          // Transform for EcosystemCard (if needed) or just keep logic consistent
          if (ecoData.suppliers.length > 0 || ecoData.clients.length > 0) {
             const transformEco = (items: any[]) => items.map(i => ({
                 id: i.partner_symbol,
                 n: i.partner_name,
                 dep: i.dependency_score,
                 val: i.partner_valuation || 0,
                 ehs: i.partner_ehs || 0,
                 fgos: i.partner_fgos || 0,
                 txt: i.risk_level 
             }));
             
             setStockEcosystem({
                 suppliers: transformEco(ecoData.suppliers),
                 clients: transformEco(ecoData.clients)
             });
          } else {
             setStockEcosystem(result.ecosystemData ?? null);
          }
        } catch (dbErr) {
          console.error("Error fetching from Fintra DB:", dbErr);
          setStockEcosystem(result.ecosystemData ?? null);
        }

      } else {
        const errorMessage = result.error || 'Error al buscar datos';
        setError(errorMessage);
      }
    } catch (e) {
      console.error(e);
      setError('Error al buscar datos de la acción');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (ticker) {
      buscarDatosAccion(ticker);
    }
  }, [ticker]);

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#0A0A0A]">
       <TickerExpandidoView
          ticker={ticker}
          selectedCompetitor={selectedCompetitor}
          setSelectedCompetitor={setSelectedCompetitor}
          stockBasicData={stockBasicData}
          stockAnalysis={stockAnalysis}
          stockPerformance={stockPerformance}
          stockEcosystem={stockEcosystem}
          stockRatios={stockRatios}
          stockMetrics={stockMetrics}
          isLoading={isLoading}
          isActive={true}
          onStockSearch={buscarDatosAccion}
          showOpenNewWindowButton={false}
       />
    </main>
  );
}
