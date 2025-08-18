'use client';

import { useState, useEffect } from 'react';
import { searchStockData, getStockConclusionData } from '@/lib/stockQueries';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flame, BarChart3, Search, Terminal } from 'lucide-react';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartTab from '@/components/tabs/ChartTab';
import InformeTab from '@/components/tabs/InformeTab';
import EstimacionTab from '@/components/tabs/EstimacionTab';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import TwitsTab from '@/components/tabs/TwitsTab';
import { supabase, registerStockSearch } from '@/lib/supabase';
import RadarPeersCard from "@/components/RadarPeersCard";
import TopSearchedStocksDropdown from '@/components/TopSearchedStocksDropdown';
import { Badge } from "@/components/ui/badge";
import ConclusionRapidaCard from '@/components/cards/ConclusionRapidaCard';
import OverviewCard from '@/components/cards/OverviewCard';
import EstimacionCard from '@/components/cards/EstimacionCard';
import Header from '@/components/layout/Header';
//import { getCompanyProfile } from '@/lib/stockQueries';


export default function StockTerminal() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState<any>('AAPL'); // puede ser string u objeto con {symbol}
  const [stockBasicData, setStockBasicData] = useState<any>(null);
  const [stockAnalysis, setStockAnalysis] = useState<any>(null);
  const [stockPerformance, setStockPerformance] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [companyImage, setCompanyImage] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'resumen'|'datos'|'chart'|'informe'|'estimacion'|'noticias'|'twits'>('datos');

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stockConclusion, setStockConclusion] = useState<any>(null);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // símbolo actual (string) sin importar si selectedStock es string u objeto
  const selectedSymbol =
  typeof selectedStock === "string"
    ? selectedStock
    : (selectedStock?.symbol ?? "AAPL");

  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Perfil compañía (para logo)
  const fetchCompanyProfile = async (symbol: string) => {
    try {
      const profile = await getCompanyProfile(symbol);
      setCompanyImage(profile.image);
    } catch {
      setCompanyImage('');
    }
  };

  useEffect(() => {
    if (selectedSymbol) fetchCompanyProfile(selectedSymbol);
  }, [selectedSymbol]);

  const isMarketOpen = () => {
    if (!currentTime) return false;
    const nyTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = nyTime.getDay();
    const minutes = nyTime.getHours() * 60 + nyTime.getMinutes();
    if (day === 0 || day === 6) return false;
    return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  };

  const toggleTheme = () => setIsDarkMode(v => !v);

  const buscarDatosAccion = async (symbol: string) => {
    if (!symbol) return;
    setIsLoading(true);
    setError('');
    try {
      await registerStockSearch(symbol);
      const result = await searchStockData(symbol, activeTab);

      if (result.success) {
        setStockBasicData(result.basicData);
        setStockAnalysis(result.analysisData);
        setStockPerformance(result.performanceData);
        setStockReport(result.reportData);
        setSelectedStock(result.basicData); // puede quedar objeto con {symbol}

        if (activeTab !== 'noticias') {
          const conclusionData = await getStockConclusionData(symbol);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) buscarDatosAccion(searchTerm.trim());
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
            symbol={selectedSymbol}          // ← importante
          />
        );
      case 'chart':
        return (
          <Dialog open={isChartModalOpen} onOpenChange={setIsChartModalOpen}>
            <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto bg-gray-900 ... backdrop-blur-md shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-green-400">
                  Charts - {selectedSymbol}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <ChartTab
                  symbol={selectedSymbol}
                  companyName={stockBasicData?.companyName}
                  liveQuoteEnabled
                />
              </div>
            </DialogContent>
          </Dialog>
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

  useEffect(() => {
    if (activeTab === 'chart') setIsChartModalOpen(true);
  }, [activeTab]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async () => {
    if (user) {
      const { error } = await supabase.auth.signOut();
      if (!error) setUser(null);
    } else {
      console.log('Redirigir a login/signup');
    }
  };

  const handleTopStockClick = (symbol: string) => {
    setSearchTerm(symbol);
    buscarDatosAccion(symbol);
  };

  return (
    <div className="bg-fondoDeTarjetas min-h-screen text-green-400">
      {/* Header */}
      <Header user={user} onAuth={handleAuth} />
      
      <div className="flex min-h-screen"> 
        {/* Contenido principal */}
        <div className="flex-1 p-2 pt-0">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border-red-500/30 rounded text-red-400">
              {error}
            </div>
          )}

          {selectedStock && (
            <>
              <div className='flex w-full items-center justify-between grid-cols-2'>
                  <div className='flex w-full flex-col'>
                  {/* Overview */}
                    <div className="space-y-4">
                      <OverviewCard
                        stockBasicData={stockBasicData}
                        stockAnalysis={stockAnalysis}
                        selectedStock={selectedStock}
                        onStockSearch={buscarDatosAccion}
                      />
                    </div>
                  </div>
                  <Card className="min-w-[350px] flex justify-between bg-transparent border-none h-[36px]">

                    <div className='flex w-full'>
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

                  {/* Tabs debajo de las columnas */}
                  <div className="w-full pt-1">
                    <div >
                      {renderTabContent()}
                    </div>
                  </div>

                  <Card className="mt-1 flex items-center justify-content bg-tarjetas border-none h-[40px]">
                    <div className='flex'>
                      <div className="flex items-center space-x-2 px-3 py-2">
                          <Flame className="w-4 h-4 text-green-400" />
                          <span className="text-orange-400 text-sm font-medium flex-shrink-0">Top:</span>
                          <div className="flex space-x-1 overflow-x-auto scrollbar-thin min-w-0">
                            <TopSearchedStocksDropdown onStockClick={handleTopStockClick} />   
                          </div>
                        </div>
                    </div>
                  </Card>
                </div>

                {/* Derecha */}
                <div className="w-1/2 flex flex-col">
                  <div className="w-full pt-1">
                    <RadarPeersCard
                      symbol={selectedSymbol || "N/A"}
                      companyName={stockBasicData?.companyName}
                      onSelectSymbol={(s) => {
                        setSearchTerm(s);
                        setSelectedStock(s);
                        buscarDatosAccion(s);
                      }}
                    />
                    
                    {/* NoticiasTab agregado debajo del RadarPeersCard */}
                    <div className="w-full pt-1">
                      <NoticiasTab 
                        stockBasicData={stockBasicData}
                        stockAnalysis={stockAnalysis}
                        selectedStock={selectedStock}
                        symbol={selectedSymbol || "N/A"}
                      />
                    </div>
                  </div>
                </div>
              </div> {/* ⬅️ cierre del contenedor de columnas */}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
