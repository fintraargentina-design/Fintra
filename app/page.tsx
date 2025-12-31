'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { StockEcosystem } from '@/lib/fmp/types';
import { StockData, StockAnalysis, StockPerformance, searchStockData } from '@/lib/stockQueries';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartsTabHistoricos from '@/components/tabs/ChartsTabHistoricos';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import MetodologiaTab from '../components/tabs/MetodologiaTab';
import { supabase, registerStockSearch } from '@/lib/supabase';
import { fmp } from '@/lib/fmp/client';
import EcosystemCard from '@/components/cards/EcosystemCard';
import CompetidoresCard from '@/components/cards/CompetidoresCard';
import OverviewCard from '@/components/cards/OverviewCard';
import EstimacionCard from '@/components/cards/EstimacionCard';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

import FGOSRadarChart from '@/components/charts/FGOSRadarChart';
import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';
import PeersAnalysisPanel from '@/components/dashboard/PeersAnalysisPanel';
import StockSearchModal from '@/components/modals/StockSearchModal';
import EstimacionTab from '@/components/tabs/EstimacionTab';
import MercadosTab from '@/components/tabs/MercadosTab';
import MarketHoursCard from '@/components/cards/MarketHoursCard';
import IndicesTab from '@/components/tabs/IndicesTab';
import { getLatestSnapshot, getEcosystemDetailed } from '@/lib/repository/fintra-db';

export type TabKey = 'resumen' | 'datos' | 'chart' | 'informe' | 'estimacion' | 'noticias' | 'twits' | 'ecosistema' | 'mercados' | 'indices';

export default function StockTerminal() {
  const [selectedStock, setSelectedStock] = useState<string | { symbol: string }>('AAPL');
  const [stockBasicData, setStockBasicData] = useState<StockData | null>(null);
  const [stockAnalysis, setStockAnalysis] = useState<StockAnalysis | null>(null);
  const [stockPerformance, setStockPerformance] = useState<StockPerformance | null>(null);
  const [stockEcosystem, setStockEcosystem] = useState<StockEcosystem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('mercados');
  const [user, setUser] = useState<any>(null);
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
    // Opcional: limpiar también competidor seleccionado si se desea
    // setSelectedCompetitor(null); 

    try {
      await registerStockSearch(sym);

      // Fetch Financial Data for Cards
      // Lanzar fetch de datos fundamentales en paralelo (sin bloquear UI principal inmediatamente si se quisiera, 
      // pero aquí lo haremos parte del flujo o separado según preferencia. 
      // El usuario pidió Promise.all para no bloquear carga PRINCIPAL, lo que sugiere lanzarlo y esperar o lanzarlo separado.
      // Vamos a lanzarlo junto con searchStockData o en paralelo.
      
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
        // setStockEcosystem(result.ecosystemData);

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
             // Si no hay datos en DB, usar lo que venga de la API o mantener null para que EcosystemCard use sus mocks por defecto si se desea,
             // o setear null explícitamente.
             setStockEcosystem(result.ecosystemData || null);
          }
        } catch (dbErr) {
          console.error("Error fetching from Fintra DB:", dbErr);
          setStockEcosystem(result.ecosystemData);
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
      case 'ecosistema':
        return (
          <EcosystemCard 
            mainTicker={selectedSymbol}
            mainImage={
              typeof selectedStock === 'string' 
                ? (stockBasicData?.image || '') 
                : ('image' in selectedStock ? (selectedStock as any).image : stockBasicData?.image || '')
            }
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
      case 'mercados':
        return <MercadosTab />;
      case 'horarios':
        return <MarketHoursCard />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Header responsivo */}
      <div className="sticky top-0 z-50 bg-fondoDeTarjetas/95 backdrop-blur supports-[backdrop-filter]:bg-fondoDeTarjetas/60 pt-1">
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
      <div className="w-full px-2 h-[calc(100vh-72px)] overflow-hidden">
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400">
            {error}
          </div>
        )}

        {selectedStock && (
          <div className="space-y-1 md:space-y-1 h-full">

            {/* Layout principal responsivo */}
            <div className="grid grid-cols-1 xl:grid-cols-[55fr_45fr] gap-0 md:gap-1 items-start h-full">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-auto flex flex-col gap-1 min-h-0 h-full overflow-hidden">
                {/* 1. Sector Analysis - 40% Fixed */}
                <div className="h-[40%] shrink-0 min-h-0 relative">
                  <SectorAnalysisPanel onStockSelect={handleTopStockClick} />
                </div>

                {/* 2. Overview - Auto Height (Fixed) */}
                <div className="shrink-0 w-full border border-zinc-800">
                  <OverviewCard
                      selectedStock={selectedStock}
                      onStockSearch={buscarDatosAccion}
                      onOpenSearchModal={() => setIsSearchOpen(true)}
                      isParentLoading={isLoading}
                      analysisData={stockAnalysis}
                    />
                </div>

                {/* 3. Peers - Flexible (Takes remaining space) */}
                <div className="flex-1 min-h-0 relative border border-zinc-800">
                  <PeersAnalysisPanel 
                    symbol={selectedSymbol} 
                    onPeerSelect={setSelectedCompetitor}
                    selectedPeer={selectedCompetitor}
                  />
                </div>

                {/* 4. Charts - 30% Fixed */}
                <div className="h-[30%] shrink-0 min-h-0 pb-1">
                  <div className="flex flex-col lg:flex-row w-full h-full gap-1">
                      {/* Chart 3/5 */}
                      <div className="w-full lg:w-3/5 h-full">
                          <ChartsTabHistoricos
                            symbol={selectedSymbol}
                            companyName={stockBasicData?.companyName}
                            comparedSymbols={selectedCompetitor ? [selectedCompetitor] : []}
                          />
                      </div>
                      {/* Radar 2/5 */}
                      <div className="w-full lg:w-2/5 h-full border border-zinc-800">
                           <FGOSRadarChart 
                              symbol={selectedSymbol} 
                              data={stockAnalysis?.fgos_breakdown} 
                              comparedSymbol={selectedCompetitor}
                           />
                      </div>
                  </div>                
                </div>
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-auto h-full flex flex-col overflow-hidden pb-1 gap-1">
                {/* Mitad Superior: Navigation Bar y Contenido de Tabs */}
                <div className="h-[60%] flex flex-col min-h-0">
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
                  
                  <div className={`w-full flex-1 scrollbar-thin border border-t-0 border-zinc-800 ${(activeTab === 'datos' || activeTab === 'mercados') ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                    {renderTabContent()}
                  </div>
                </div>

                {/* Mitad Inferior: Noticias */}
                <div className="flex-1 flex flex-col min-h-0 border border-zinc-800">
                  {/* <div className="p-2 border-b border-white/5 bg-white/[0.02]">
                    <h3 className="text-[#FFA028] font-medium text-center text-sm">Noticias</h3>
                  </div> */}
                  <div className="flex-1 overflow-hidden">
                    <NoticiasTab symbol={selectedSymbol} />
                  </div>
                </div>
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
