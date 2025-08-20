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

  const buscarDatosAccion = async (symbol: string) => {
    const sym = symbol?.trim().toUpperCase();
    if (!sym) return;
    setIsLoading(true);
    setError('');
    try {
      await registerStockSearch(sym);
      const result = await searchStockData(sym, activeTab);

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
        setError(result.error || 'Error al buscar datos');
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
    <div className="bg-fondoDeTarjetas">
      {/* Header */}
      <Header user={user} onAuth={handleAuth} onSelectSymbol={handleTopStockClick} />

      <div className="flex">
        {/* Contenido principal */}
        <div className="flex-1 p-2 pt-0">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border-red-500/30 rounded text-red-400">
              {error}
            </div>
          )}

          {selectedStock && (
            <>
              <div className="flex w-full items-center justify-between grid-cols-2">
                <div className="flex w-full flex-col">
                  {/* Overview */}
                  <div className="space-y-4">
                    <OverviewCard
                      selectedStock={selectedStock}
                      onStockSearch={buscarDatosAccion}
                    />
                  </div>
                </div>

                <Card className="min-w-[350px] flex justify-between bg-transparent border-none h-[36px]">
                  <div className="flex w-full">
                    <div className="flex w-full items-center py-2">
                      <div className="flex w-full min-w-0">
                        <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex gap-1">
                {/* Izquierda */}
                <div className="w-1/2 flex flex-col">
                  <div className="w-full pt-1">
                    <RadarPeersCard symbol={selectedSymbol} />

                    {/* Noticias debajo del radar */}
                    <div className="w-full pt-1">
                      <NoticiasTab
                        stockBasicData={stockBasicData}
                        stockAnalysis={stockAnalysis}
                        selectedStock={selectedStock}
                        symbol={selectedSymbol || 'N/A'}
                      />
                    </div>
                  </div>
                </div>

                {/* Derecha */}
                <div className="w-1/2 flex flex-col">
                  <div className="w-full pt-1">
                    <div>{renderTabContent()}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
