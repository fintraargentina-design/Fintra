'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { StockEcosystem } from '@/lib/fmp/types';
import { StockData, StockAnalysis, StockPerformance, searchStockData } from '@/lib/stockQueries';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartsTabHistoricos from '@/components/tabs/ChartsTabHistoricos';
import FGOSRadarChart from "@/components/charts/FGOSRadarChart";
import NoticiasTab from '@/components/tabs/NoticiasTab';
import TwitsTab from '@/components/tabs/TwitsTab';
import { supabase, registerStockSearch } from '@/lib/supabase';
import { fmp } from '@/lib/fmp/client';
import EcosystemCard from '@/components/cards/EcosystemCard';
import CompetidoresTab from '@/components/tabs/CompetidoresTab';
import OverviewCard from '@/components/cards/OverviewCard';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';
import PeersAnalysisPanel from '@/components/dashboard/PeersAnalysisPanel';
import TickerSearchPanel from '@/components/dashboard/TickerSearchPanel';
import StockSearchModal from '@/components/modals/StockSearchModal';
import EstimacionTab from '@/components/tabs/EstimacionTab';
import MercadosTab from '@/components/tabs/MercadosTab';
import ResumenTab from '@/components/tabs/ResumenTab';
import { getLatestSnapshot, getEcosystemDetailed } from '@/lib/repository/fintra-db';
import { User } from '@supabase/supabase-js';

export type TabKey = 'resumen' | 'competidores' | 'datos' | 'chart' | 'informe' | 'estimacion' | 'noticias' | 'twits' | 'ecosistema' | 'indices' | 'horarios' | 'empresa';

export default function StockTerminal() {
  const [selectedStock, setSelectedStock] = useState<string | { symbol: string }>('AAPL');
  const [stockBasicData, setStockBasicData] = useState<StockData | null>(null);
  const [stockAnalysis, setStockAnalysis] = useState<StockAnalysis | null>(null);
  const [stockPerformance, setStockPerformance] = useState<StockPerformance | null>(null);
  const [stockEcosystem, setStockEcosystem] = useState<StockEcosystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('empresa');
  const [user, setUser] = useState<User | null>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Estados para FundamentalCard (Prop Drilling)
  const [stockRatios, setStockRatios] = useState<any>(null);
  const [stockMetrics, setStockMetrics] = useState<any>(null);

  // símbolo actual (string) sin importar si selectedStock es string u objeto
  const selectedSymbol = useMemo(() => {
    if (typeof selectedStock === 'string') return selectedStock.toUpperCase?.() || '';
    return (selectedStock?.symbol || '').toUpperCase();
  }, [selectedStock]);

  // Cargar sesión y suscripción a cambios de auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(session?.user || null);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => {
      subscription?.unsubscribe();
      mounted = false;
    };
  }, []);

  // Cargar datos automáticamente para el símbolo inicial
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== 'N/A' && selectedSymbol !== '') {
      buscarDatosAccion(selectedSymbol);
    }
  }, [selectedSymbol]);

  const lastRequestedSymbolRef = useRef<string>('');

  const buscarDatosAccion = async (symbol: string) => {
    const sym = symbol?.trim().toUpperCase();
    if (!sym) return;
    
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
             // Aquí podríamos actualizar stockAnalysis con datos de la DB si se prefiere
             if (snapshot.fgos_breakdown) {
                setStockAnalysis((prev: any) => ({
                    ...prev,
                    fgos_breakdown: snapshot.fgos_breakdown
                }));
             }
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

        setSelectedStock(result.basicData || sym); // mantiene objeto con {symbol} si viene
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

  const handleAuth = async () => {
    if (user) {
      const { error } = await supabase.auth.signOut();
      if (!error) setUser(null);
    } else {
      // aquí podrías redirigir a login
    }
  };

  const handleTopStockClick = (symbol: string) => {
    buscarDatosAccion(symbol);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'empresa':
        return (
          <ResumenTab 
            stockBasicData={stockBasicData} 
            stockAnalysis={stockAnalysis}
            symbol={selectedSymbol}
            onPeerSelect={setSelectedCompetitor}
            selectedPeer={selectedCompetitor}
            onStockSearch={buscarDatosAccion}
            onOpenSearchModal={() => setIsSearchOpen(true)}
            isLoading={isLoading}
          />
        );
      case 'competidores':
        return (
          <CompetidoresTab
            symbol={selectedSymbol}
            onPeerSelect={setSelectedCompetitor}
            selectedPeer={selectedCompetitor}
          />
        );
      case 'ecosistema':
        return (
          <EcosystemCard 
            mainTicker={selectedSymbol}
            suppliers={stockEcosystem?.suppliers}
            clients={stockEcosystem?.clients}
          />
        );
      case 'datos':
        return (
          <DatosTab
            stockAnalysis={stockAnalysis}
            stockPerformance={stockPerformance}
            stockBasicData={stockBasicData}
            symbol={selectedSymbol}
            ratios={stockRatios}
            metrics={stockMetrics}
          />
        );
      case 'chart':
        return (
          <ChartsTabHistoricos
            symbol={selectedSymbol}
            companyName={stockBasicData?.companyName}
            comparedSymbols={selectedCompetitor ? [selectedCompetitor] : []}
          />
        );
      case 'estimacion':
        return (
          <EstimacionTab 
            selectedStock={selectedStock}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-black overflow-hidden">
      {/* Header responsivo */}
      <div className="shrink-0 z-50 bg-fondoDeTarjetas/95 backdrop-blur supports-[backdrop-filter]:bg-fondoDeTarjetas/60 pt-1">
        <Header 
          user={user}
          onAuth={handleAuth}
          onSelectSymbol={handleTopStockClick}
          showTimes={true}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          symbol={selectedSymbol}
        />
      </div>

      {/* Contenedor principal responsivo - Ancho completo */}
      <div className="flex-1 w-full px-1 min-h-0 overflow-hidden relative">
        {error && (
          <div className="mb-0 p-0 bg-red-500/20 border border-red-500/30 rounded-none text-red-400 text-sm">
            {error}
          </div>
        )}

        {selectedStock && (
          <div className="space-y-1 md:space-y-1 h-full">

            {/* Layout principal responsivo */}
            <div className="grid grid-cols-1 xl:grid-cols-[50fr_50fr] gap-0 md:gap-1 items-start h-full">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-auto flex flex-col gap-1 min-h-0 h-full overflow-hidden">
                <div className="w-full h-[60%] flex flex-col min-h-0">
                  <Tabs defaultValue="mercados" className="w-full h-full flex flex-col">
                    <div className="w-full border-b border-zinc-800 bg-transparent z-10 shrink-0">
                      <div className="w-full overflow-x-auto scrollbar-thin whitespace-nowrap">
                        <TabsList className="bg-transparent h-auto p-0 flex min-w-full w-max gap-0.5 border-b-2 border-black justify-start">
                          <TabsTrigger 
                            value="mercados"
                            className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#0056FF] data-[state=active]:text-white text-xs px-4 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors w-auto"
                          >
                            Mercados
                          </TabsTrigger>
                          <TabsTrigger 
                            value="sector_score"
                            className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#0056FF] data-[state=active]:text-white text-xs px-4 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors w-auto"
                          >
                            Clasificación Fintra - FSS
                          </TabsTrigger>
                          <TabsTrigger 
                            value="ticker_search"
                            className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#0056FF] data-[state=active]:text-white text-xs px-4 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors w-auto"
                          >
                            Screener
                          </TabsTrigger>
                        </TabsList>
                      </div>
                    </div>
                    
                    <TabsContent value="sector_score" className="flex-1 min-h-0 mt-0">
                      <SectorAnalysisPanel onStockSelect={handleTopStockClick} />
                    </TabsContent>
                    
                    <TabsContent value="ticker_search" className="flex-1 min-h-0 mt-0">
                      <TickerSearchPanel onStockSelect={handleTopStockClick} />
                    </TabsContent>
                    
                    <TabsContent value="mercados" className="flex-1 min-h-0 pb-1 mt-0">
                      <MercadosTab />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="w-full h-[40%] grid grid-cols-2 gap-1 min-h-0">
                   <div className="h-full w-full overflow-hidden rounded border border-zinc-800 bg-tarjetas relative">
                      <NoticiasTab symbol={selectedSymbol} />
                   </div>
                   <div className="h-full w-full overflow-hidden rounded border border-zinc-800 bg-tarjetas relative">
                      <TwitsTab />
                   </div>
                </div>
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-auto h-full flex flex-col overflow-hidden pb-1 gap-1">
                <Tabs defaultValue="main_view" className="w-full h-full flex flex-col">
                  <div className="w-full border-b border-zinc-800 bg-transparent z-10 shrink-0">
                    <div className="w-full overflow-x-auto scrollbar-thin whitespace-nowrap">
                      <TabsList className="bg-transparent h-auto p-0 flex min-w-full w-max gap-0.5 border-b-2 border-black justify-end">
                        <TabsTrigger 
                          value="main_view"
                          className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#0056FF] data-[state=active]:text-white text-xs px-4 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors w-auto"
                        >
                          {selectedSymbol}
                        </TabsTrigger>
                      </TabsList>
                    </div>
                  </div>

                  <TabsContent value="main_view" className="flex-1 min-h-0 mt-0 flex flex-col">
                    {/* Overview Section - Always visible */}
                    <div className="shrink-0 w-full border-zinc-800 h-[6%] overflow-hidden py-0 bg-tarjetas">
                      <OverviewCard
                        selectedStock={stockBasicData || selectedSymbol}
                        onStockSearch={buscarDatosAccion}
                        onOpenSearchModal={() => setIsSearchOpen(true)}
                        isParentLoading={isLoading}
                        analysisData={stockAnalysis}
                      />
                    </div>

                    <div className="shrink-0 w-full border-zinc-800 h-[20%] overflow-hidden bg-tarjetas">
                        <PeersAnalysisPanel 
                            symbol={selectedSymbol}
                            onPeerSelect={setSelectedCompetitor}
                            selectedPeer={selectedCompetitor}
                        />
                    </div>

                    {/* Mitad Superior: Navigation Bar y Contenido de Tabs */}
                    <div className="flex-1 flex flex-col min-h-0 mt-1">
                      <div className="w-full flex items-center justify-between ">
                        <div className="flex-1">
                          <NavigationBar
                            orientation="horizontal"
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            symbol={selectedSymbol}
                          />
                        </div>
                      </div>
                      
                      <div className={`w-full flex-1 scrollbar-thin border-zinc-800 ${(activeTab === 'datos' || activeTab === 'competidores') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                        {renderTabContent()}
                      </div>

                      {/* Charts Section - Fixed Height 30% */}
                      <div className="flex flex-col lg:flex-row w-full h-[38%] gap-1 shrink-0 border-t border-zinc-800 pt-1">
                          <div className="w-full lg:w-3/5 h-full border border-zinc-800 bg-tarjetas overflow-hidden">
                              <ChartsTabHistoricos
                                  symbol={selectedSymbol}
                                  companyName={stockBasicData?.companyName}
                                  comparedSymbols={selectedCompetitor ? [selectedCompetitor] : []}
                              />
                          </div>
                          <div className="w-full lg:w-2/5 h-full border border-zinc-800 bg-tarjetas overflow-hidden">
                              <FGOSRadarChart 
                                  symbol={selectedSymbol} 
                                  data={stockAnalysis?.fgos_breakdown} 
                                  comparedSymbol={selectedCompetitor}
                              />
                          </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        )}
      </div>
      <StockSearchModal 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelectSymbol={handleTopStockClick} 
      />
      <Footer />
    </div>
  );
}
