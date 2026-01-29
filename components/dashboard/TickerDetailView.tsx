'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { StockEcosystem } from '@/lib/fmp/types';
import { StockData, StockAnalysis, StockPerformance, searchStockData } from '@/lib/stockQueries';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosFinancierosTab from '@/components/tabs/DatosFinancierosTab';
import SnapshotTab from '@/components/tabs/SnapshotTab';
import ChartsTabHistoricos from '@/components/tabs/ChartsTabHistoricos';
import { registerStockSearch } from '@/lib/supabase';
import { fmp } from '@/lib/fmp/client';
import EcosystemCard from '@/components/cards/EcosystemCard';
import ScenariosTab from '@/components/tabs/ScenariosTab';
import ConclusionTab from '@/components/tabs/ConclusionTab';
import ResumenTab from '@/components/tabs/ResumenTab';
import { getLatestSnapshot, getEcosystemDetailed } from '@/lib/repository/fintra-db';
import { buildFGOSState } from '@/lib/engine/fgos-state';
import TickerExpandidoModal from '@/components/dashboard/TickerExpandidoModal';
import type { TabKey } from '@/components/dashboard/StockTerminal';

interface TickerDetailViewProps {
  ticker: string;
  isActive: boolean;
  onTickerChange?: (ticker: string) => void;
}

export default function TickerDetailView({ ticker, isActive, onTickerChange }: TickerDetailViewProps) {
  const [stockBasicData, setStockBasicData] = useState<StockData | null>(null);
  const [stockAnalysis, setStockAnalysis] = useState<StockAnalysis | null>(null);
  const [stockPerformance, setStockPerformance] = useState<StockPerformance | null>(null);
  const [stockEcosystem, setStockEcosystem] = useState<StockEcosystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('snapshot');
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [isExpandedOpen, setIsExpandedOpen] = useState(false);

  // Estados para FundamentalCard (Prop Drilling)
  const [stockRatios, setStockRatios] = useState<any>(null);
  const [stockMetrics, setStockMetrics] = useState<any>(null);

  // Memoize comparedSymbols to prevent unnecessary re-renders in ChartsTabHistoricos
  const comparedSymbolsList = useMemo(() => selectedCompetitor ? [selectedCompetitor] : [], [selectedCompetitor]);

  const lastRequestedSymbolRef = useRef<string>('');

  const buscarDatosAccion = async (symbol: string) => {
    const sym = symbol?.trim().toUpperCase();
    if (!sym) return;
    
    // If the search is for a different ticker than current prop, notify parent
    if (sym !== ticker && onTickerChange) {
        onTickerChange(sym);
        return; // Parent will update prop, which triggers useEffect
    }
    
    // If it's the same ticker (or initial load), we proceed to fetch
    lastRequestedSymbolRef.current = sym;
    
    setIsLoading(true);
    setError('');
    // Resetear estados previos
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
        // Fetch explícito de Ratios y Metrics TTM
        Promise.all([
          fmp.ratiosTTM(sym).catch(err => { console.error("Ratios fetch error", err); return []; }),
          fmp.keyMetricsTTM(sym).catch(err => { console.error("Metrics fetch error", err); return []; })
        ])
      ]);

      // Verificar si seguimos en el mismo símbolo
      if (lastRequestedSymbolRef.current !== sym) {
        console.log(`Ignoring result for ${sym} as user switched to ${lastRequestedSymbolRef.current}`);
        return;
      }

      // Procesar fundamentales
      const [ratiosData, metricsData] = fundamentals;
      setStockRatios(ratiosData?.[0] || null);
      setStockMetrics(metricsData?.[0] || null);

      if (result.success) {
        setStockBasicData(result.basicData || null);
        setStockAnalysis(result.analysisData || null);
        setStockPerformance(result.performanceData || null);

        // --- INTEGRACIÓN FINTRA DB ---
        try {
          // 1. Obtener Snapshot más reciente (demo)
          const snapshot = await getLatestSnapshot(sym);
          
          if (lastRequestedSymbolRef.current !== sym) return; // Check again after await

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
                 ...snapshot, // Propagate all snapshot fields (relative_vs_*, snapshot_date, etc.)
                 fgos_breakdown: (snapshot as any).fgos_components || (snapshot as any).fgos_breakdown,
                 fgos_state: fgosState
             }));
          }

          // 2. Obtener Ecosistema Detallado
          const ecoData = await getEcosystemDetailed(sym);
          
          if (lastRequestedSymbolRef.current !== sym) return; // Check again after await
          
          // Transformar para el componente EcosystemCard
          if (ecoData.suppliers.length > 0 || ecoData.clients.length > 0) {
             const transformEco = (items: any[]) => items.map(i => ({
                 id: i.partner_symbol,
                 n: i.partner_name,
                 dep: i.dependency_score,
                 val: i.partner_valuation || 0,
                 ehs: i.partner_ehs || 0,
                 fgos: i.partner_fgos || 0,
                 txt: i.risk_level // o i.partner_verdict
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

        // We don't call setSelectedStock here because we are controlled by props
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

  // Cargar datos automáticamente para el símbolo
  useEffect(() => {
    console.log(`[TickerDetailView] useEffect triggered. ticker: "${ticker}"`);
    if (ticker && ticker !== 'N/A' && ticker !== '') {
      buscarDatosAccion(ticker);
    }
  }, [ticker]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'empresa':
        return (
          <ResumenTab 
            stockBasicData={stockBasicData} 
            stockAnalysis={stockAnalysis}
            symbol={ticker}
            onPeerSelect={setSelectedCompetitor}
            selectedPeer={selectedCompetitor}
            onStockSearch={buscarDatosAccion}
            isLoading={isLoading}
          />
        );
      case 'ecosistema':
        return (
          <EcosystemCard 
            mainTicker={ticker}
            suppliers={stockEcosystem?.suppliers}
            clients={stockEcosystem?.clients}
          />
        );
      case 'snapshot':
        return (
          <SnapshotTab
            stockAnalysis={stockAnalysis}
            stockPerformance={stockPerformance}
            stockBasicData={stockBasicData}
            symbol={ticker}
            ratios={stockRatios}
            metrics={stockMetrics}
            peerTicker={selectedCompetitor}
          />
        );
      case 'datos':
        return (
          <DatosFinancierosTab
            stockAnalysis={stockAnalysis}
            stockPerformance={stockPerformance}
            stockBasicData={stockBasicData}
            ticker={ticker}
            ratios={stockRatios}
            metrics={stockMetrics}
            peerTicker={selectedCompetitor}
          />
        );
      case 'chart':
        return (
          <ChartsTabHistoricos
            symbol={ticker}
            companyName={stockBasicData?.companyName}
            comparedSymbols={comparedSymbolsList}
            isActive={isActive}
          />
        );
      case 'escenarios':
        return (
          <ScenariosTab 
            marketScenarios={(stockAnalysis as any)?.market_scenarios}
            sensitivities={(stockAnalysis as any)?.sensitivities}
          />
        );
      case 'conclusion':
        return (
          <ConclusionTab 
            selectedStock={stockBasicData || { symbol: ticker }}
            stockAnalysis={stockAnalysis}
            aiAnalysis={(stockAnalysis as any)?.ai_analysis_text}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0A]">
      <div className="shrink-0 w-full h-[45px] flex flex-col bg-tarjetas border-b border-zinc-800">
        <div className="w-full flex items-center px-1 pt-1">
          <NavigationBar
            orientation="horizontal"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            symbol={ticker}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="w-full flex-1 overflow-y-auto"
        >
          {renderTabContent()}
        </div>
      </div>

      <TickerExpandidoModal
        open={isExpandedOpen}
        onOpenChange={setIsExpandedOpen}
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
        isActive={isActive}
        onStockSearch={buscarDatosAccion}
      />
    </div>
  );
}
