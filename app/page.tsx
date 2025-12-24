'use client';

import { useState, useEffect, useMemo } from 'react';
import { searchStockData, getStockConclusionData } from '@/lib/stockQueries';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartsTabHistoricos from '@/components/tabs/ChartsTabHistoricos';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import MetodologiaTab from '../components/tabs/MetodologiaTab';
import { supabase, registerStockSearch } from '@/lib/supabase';
import { fmp } from '@/lib/fmp/client';
import EcosystemCard from '@/components/cards/EcosystemCard';
import ConclusionRapidaCard from '@/components/cards/ConclusionRapidaCard';
import CompetidoresCard from '@/components/cards/CompetidoresCard';
import OverviewCard from '@/components/cards/OverviewCard';
import EstimacionCard from '@/components/cards/EstimacionCard';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

import { MOCK_AAPL_SNAPSHOT } from '@/lib/demo/aapl-snapshot';
import FGOSRadarChart from '@/components/charts/FGOSRadarChart';
import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';
import PeersAnalysisPanel from '@/components/dashboard/PeersAnalysisPanel';

export type TabKey = 'resumen' | 'datos' | 'chart' | 'informe' | 'estimacion' | 'noticias' | 'twits' | 'metodologia' | 'ecosistema';

export default function StockTerminal() {
  const [selectedStock, setSelectedStock] = useState<any>('AAPL'); // puede ser string u objeto con {symbol}
  const [stockBasicData, setStockBasicData] = useState<any>(null);
  const [stockAnalysis, setStockAnalysis] = useState<any>(null);
  const [stockPerformance, setStockPerformance] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [stockEcosystem, setStockEcosystem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('ecosistema');
  const [user, setUser] = useState<any>(null);
  const [stockConclusion, setStockConclusion] = useState<any>(null);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);

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

  const buscarDatosAccion = async (symbol: string) => {
    const sym = symbol?.trim().toUpperCase();
    if (!sym) return;
    setIsLoading(true);
    setError('');
    try {
      await registerStockSearch(sym);
      const result = await searchStockData(sym);

      if (result.success) {
        setStockBasicData(result.basicData);
        setStockAnalysis(result.analysisData);
        setStockPerformance(result.performanceData);
        setStockReport(result.reportData);
        setStockEcosystem(result.ecosystemData);
        setSelectedStock(result.basicData || sym); // mantiene objeto con {symbol} si viene

        if (activeTab !== 'noticias') {
          const conclusionData = await getStockConclusionData(sym);
          setStockConclusion(conclusionData);
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
            symbol={selectedSymbol}
            holders={stockEcosystem?.holders}
            insiders={stockEcosystem?.insiders}
          />
        );
      case 'datos':
        return (
          <DatosTab
            stockAnalysis={stockAnalysis}
            stockPerformance={stockPerformance}
            stockBasicData={stockBasicData}
            stockReport={stockReport}
            symbol={selectedSymbol}
          />
        );
      case 'chart':
        return (
          <ChartsTabHistoricos
            symbol={selectedSymbol}
            companyName={stockBasicData?.companyName}
          />
        );
      case 'estimacion':
        return (
          <EstimacionCard 
            selectedStock={selectedStock}
            fundamentalData={stockBasicData?.datos?.fundamentales}
            valoracionData={stockBasicData?.datos?.valoracion}
            financialScoresData={stockBasicData?.datos?.financialScores}
            overviewData={stockBasicData}
            estimacionData={stockBasicData?.datos?.estimacion}
            dividendosData={stockBasicData?.datos?.dividendos}
            desempenoData={stockBasicData?.datos?.desempeno}
          />
        );
      case 'noticias':
        return <NoticiasTab symbol={selectedSymbol} />;
      case 'metodologia':
        return <MetodologiaTab />;
      default:
        return (
          <ConclusionRapidaCard
            stockBasicData={stockBasicData}
            stockAnalysis={stockAnalysis}
            stockConclusion={stockConclusion}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-fondoDeTarjetas">
      {/* Header responsivo */}
      <div className="sticky top-0 z-50 bg-fondoDeTarjetas/95 backdrop-blur supports-[backdrop-filter]:bg-fondoDeTarjetas/60 border-b border-orange-400/50">
        <Header 
          user={user}
          onAuth={handleAuth}
          onSelectSymbol={handleTopStockClick}
          showTimes={true}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          symbol={selectedSymbol}
          fundamentalData={stockBasicData?.datos?.fundamentales}
          valoracionData={stockBasicData?.datos?.valoracion}
          financialScoresData={stockBasicData?.datos?.financialScores}
          overviewData={stockBasicData}
          estimacionData={stockBasicData?.datos?.estimacion}
          dividendosData={stockBasicData?.datos?.dividendos}
          desempenoData={stockBasicData?.datos?.desempeno}
        />
      </div>

      {/* Contenedor principal responsivo - Ancho completo */}
      <div className="w-full px-2 sm:px-2 lg:px-2 xl:px-2 pt-2 pb-2 sm:pb-2 lg:pb-2 xl:pb-2 h-[calc(100vh-72px)] overflow-hidden">
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400">
            {error}
          </div>
        )}

        {selectedStock && (
          <div className="space-y-1 md:space-y-1">

            {/* Layout principal responsivo */}
            <div className="grid grid-cols-1 xl:grid-cols-[55%_45%] gap-2 md:gap-1 items-start h-full">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-auto space-y-2 md:space-y-1 min-h-0 max-h-[calc(100vh-64px)] overflow-y-auto scrollbar-thin">
                <div className="w-full flex flex-col gap-0 space-y-0">
                  <SectorAnalysisPanel />
                  <PeersAnalysisPanel symbol={selectedSymbol} />
                </div>
                <div className="w-full">
                  <OverviewCard
                      selectedStock={selectedStock}
                      stockConclusion={stockConclusion}
                      onStockSearch={buscarDatosAccion}
                      isParentLoading={isLoading}
                      analysisData={stockAnalysis || MOCK_AAPL_SNAPSHOT}
                    />
                </div>

                {/* Charts & Radar Row */}
                <div className="flex flex-col lg:flex-row gap-2 w-full h-[500px]">
                    {/* Chart 3/5 */}
                    <div className="w-full lg:w-3/5 h-full">
                        <ChartsTabHistoricos
                          symbol={selectedSymbol}
                          companyName={stockBasicData?.companyName}
                        />
                    </div>
                    {/* Radar 2/5 */}
                    <div className="w-full lg:w-2/5 h-full">
                         <FGOSRadarChart 
                            symbol={selectedSymbol} 
                            data={stockAnalysis?.fgos_breakdown || MOCK_AAPL_SNAPSHOT.fgos_breakdown} 
                         />
                    </div>
                </div>

                {/* Grid responsivo para tarjetas */}
                <div className="gap-1 md:gap-1">     {/* grid grid-cols-1 lg:grid-cols-2 */}
                  {/* <div className="w-full">
                    <CompetidoresCard 
                      symbol={selectedSymbol} 
                      onCompetitorSelect={setSelectedCompetitor}
                      onCompetitorSearch={buscarDatosAccion}
                      selectedCompetitor={selectedCompetitor}
                    />
                  </div> */}
                  {/* <div className="w-full">
                    <RadarPeersCard 
                      symbol={selectedSymbol} 
                      selectedCompetitor={selectedCompetitor}
                    />
                  </div> */}
                </div>
                
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-auto min-h-0 max-h-[calc(100vh-64px)] overflow-y-auto scrollbar-thin flex flex-col gap-2">
                {/* Navigation Bar responsiva y Settings */}
                <div className="w-full flex items-center justify-between px-1">
                  <div className="flex-1">
                    <NavigationBar
                      orientation="horizontal"
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      symbol={selectedSymbol}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="relative group text-gray-400 hover:text-white hover:bg-gray-800 p-2 w-8 h-8 flex items-center justify-center ml-2"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="pointer-events-none absolute top-full right-0 mt-2 px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg z-20">
                      Configuración
                    </span>
                  </Button>
                </div>
                
                <div className="w-full">
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
