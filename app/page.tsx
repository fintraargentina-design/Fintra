'use client';

import { useState, useEffect, useMemo } from 'react';
import { searchStockData, getStockConclusionData } from '@/lib/stockQueries';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartsTabHistoricos from '@/components/tabs/ChartsTabHistoricos';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import MetodologiaTab from '../components/tabs/MetodologiaTab';
import { supabase, registerStockSearch } from '@/lib/supabase';
import ConclusionRapidaCard from '@/components/cards/ConclusionRapidaCard';
import CompetidoresCard from '@/components/cards/CompetidoresCard';
import OverviewCard from '@/components/cards/OverviewCard';
import EstimacionCard from '@/components/cards/EstimacionCard';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

import { MOCK_AAPL_SNAPSHOT } from '@/lib/demo/aapl-snapshot';
import EcosystemCard from '@/components/cards/EcosystemCard';
import FGOSRadarChart from '@/components/charts/FGOSRadarChart';
import FinancialScoresCard from '@/components/cards/FinancialScoresCard';
import ValuationThermometer from '@/components/cards/ValuationThermometer';

export type TabKey = 'resumen' | 'datos' | 'chart' | 'informe' | 'estimacion' | 'noticias' | 'twits' | 'metodologia';

export default function StockTerminal() {
  const [selectedStock, setSelectedStock] = useState<any>('AAPL'); // puede ser string u objeto con {symbol}
  const [stockBasicData, setStockBasicData] = useState<any>(null);
  const [stockAnalysis, setStockAnalysis] = useState<any>(null);
  const [stockPerformance, setStockPerformance] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('chart');
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
        return <EstimacionCard selectedStock={selectedStock} />;
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
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_auto] gap-2 md:gap-1 items-start h-full">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-auto space-y-2 md:space-y-1 min-h-0 max-h-[calc(100vh-64px)] overflow-y-auto scrollbar-thin">
                <div className="w-full">
                  <OverviewCard
                      selectedStock={selectedStock}
                      onStockSearch={buscarDatosAccion}
                      isParentLoading={isLoading}
                    />
                </div>
                <div className="w-full">
                    <FinancialScoresCard symbol={selectedSymbol} />
                </div>

                {/* 2. NUEVO: Termómetro Independiente */}
                <div className="w-full mb-2">
                    <ValuationThermometer symbol={selectedSymbol} />
                </div>
                
                {/* SECCIÓN DEMO: LA FOTO COMPLETA */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mb-2 h-[380px]">
                  <div className="w-full h-full">
                    {/* Pasa los datos del Mock al Radar */}
                    <FGOSRadarChart symbol={selectedSymbol} data={MOCK_AAPL_SNAPSHOT.fgos_breakdown} />
                  </div>
                  <div className="w-full h-full">
                    {/* Pasa los datos del Mock al Ecosistema */}
                    <EcosystemCard symbol={selectedSymbol} data={MOCK_AAPL_SNAPSHOT.ecosystem_details} />
                  </div>
                </div>

                {/* Grid responsivo para tarjetas */}
                <div className="gap-1 md:gap-1">     {/* grid grid-cols-1 lg:grid-cols-2 */}
                  <div className="w-full">
                    <CompetidoresCard 
                      symbol={selectedSymbol} 
                      onCompetitorSelect={setSelectedCompetitor}
                      onCompetitorSearch={buscarDatosAccion}
                      selectedCompetitor={selectedCompetitor}
                    />
                  </div>
                  {/* <div className="w-full">
                    <RadarPeersCard 
                      symbol={selectedSymbol} 
                      selectedCompetitor={selectedCompetitor}
                    />
                  </div> */}
                </div>
                
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-auto min-h-0 max-h-[calc(100vh-64px)] overflow-y-auto scrollbar-thin">
                {/* Navigation Bar responsiva (removida, ahora está en Header) */}
                <div className="w-full">
                  {renderTabContent()}
                </div>
              </div>

              {/* Tercera columna: NavigationBar vertical */}
              <div className="hidden xl:flex xl:flex-col items-start justify-start gap-2 overflow-visible">
                <NavigationBar
                  orientation="vertical"
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
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="relative group text-gray-400 hover:text-white hover:bg-gray-800 p-2 w-8 h-8 flex items-center justify-center"
                >
                  <Settings className="h-4 w-4" />
                  <span className="pointer-events-none absolute top-1/2 right-full -translate-y-1/2 mr-2 px-2 py-1 rounded-md bg-gray-800 text-gray-200 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 shadow-lg z-20">
                    Configuración
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
