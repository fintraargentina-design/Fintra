'use client';

import { useState, useEffect, useMemo } from 'react';
import { searchStockData, getStockConclusionData } from '@/lib/stockQueries';
import { Card } from '@/components/ui/card';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartsTabHistoricos from '@/components/tabs/ChartsTabHistoricos';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import { supabase, registerStockSearch } from '@/lib/supabase';
import RadarPeersCard from '@/components/RadarPeersCard';
import ConclusionRapidaCard from '@/components/cards/ConclusionRapidaCard';
import OverviewCard from '@/components/cards/OverviewCard';
import EstimacionCard from '@/components/cards/EstimacionCard';
import Header from '@/components/layout/Header';
import FinancialScoresCard from '@/components/cards/FinancialScoresCard';

type TabKey = 'resumen' | 'datos' | 'chart' | 'informe' | 'estimacion' | 'noticias' | 'twits';

export default function StockTerminal() {
  const [selectedStock, setSelectedStock] = useState<any>('AAPL'); // puede ser string u objeto con {symbol}
  const [stockBasicData, setStockBasicData] = useState<any>(null);
  const [stockAnalysis, setStockAnalysis] = useState<any>(null);
  const [stockPerformance, setStockPerformance] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('datos');
  const [user, setUser] = useState<any>(null);
  const [stockConclusion, setStockConclusion] = useState<any>(null);

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
        const errorMessage = typeof result.error === 'string' 
          ? result.error 
          : result.error?.message || 'Error al buscar datos';
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
      console.log('Redirigir a login/signup');
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
      <div className="sticky top-0 z-50 bg-fondoDeTarjetas/95 backdrop-blur supports-[backdrop-filter]:bg-fondoDeTarjetas/60 mb-2 border-b border-gray-600">
        <Header user={user} onAuth={handleAuth} onSelectSymbol={handleTopStockClick} />
      </div>

      {/* Contenedor principal responsivo - Ancho completo */}
      <div className="w-full px-2 sm:px-4 lg:px-6 xl:px-8">
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400">
            {error}
          </div>
        )}

        {selectedStock && (
          <div className="space-y-1 md:space-y-1">

            {/* Layout principal responsivo */}
            <div className="flex flex-col xl:flex-row gap-2 md:gap-4">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-1/2 space-y-2 md:space-y-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                  <OverviewCard
                      selectedStock={selectedStock}
                      onStockSearch={buscarDatosAccion}
                      isParentLoading={isLoading}
                    />
                </div>
                {/* Grid responsivo para tarjetas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-1">
                  <div className="w-full">
                    <RadarPeersCard symbol={selectedSymbol} />
                  </div>
                  <div className="w-full">
                    <FinancialScoresCard symbol={selectedSymbol} />
                  </div>
                </div>

                {/* Noticias - ancho completo */}
                <div className="w-full">
                  <NoticiasTab
                    stockBasicData={stockBasicData}
                    stockAnalysis={stockAnalysis}
                    selectedStock={selectedStock}
                    symbol={selectedSymbol || 'N/A'}
                  />
                </div>
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-1/2">
                {/* Navigation Bar responsiva */}
                <div className="lg:min-w-[350px]">
                  <Card className="flex justify-end bg-transparent border-none">
                    <div className="p-2">
                      <NavigationBar 
                        activeTab={activeTab} 
                        setActiveTab={setActiveTab}
                        symbol={selectedSymbol}
                        fundamentalData={stockBasicData?.datos?.fundamentales || null}
                        valoracionData={stockBasicData?.datos?.valoracion || null}
                        financialScoresData={stockBasicData?.datos?.financialScores || null}
                        overviewData={stockBasicData}
                        estimacionData={stockBasicData?.datos?.estimacion || null}
                        dividendosData={stockBasicData?.datos?.dividendos || null}
                        desempenoData={stockBasicData?.datos?.desempeno || null}
                      />
                    </div>
                  </Card>
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
