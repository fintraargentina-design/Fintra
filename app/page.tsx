'use client';

import { useState, useEffect } from 'react';
import { searchStockData, getStockConclusionData } from '@/lib/stockQueries';
import { getCompanyProfile } from '@/api/fmpCompanyProfiles';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart3, Search, Terminal, Sun, Moon } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'resumen'|'datos'|'chart'|'informe'|'estimacion'|'noticias'|'twits'>('resumen');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stockConclusion, setStockConclusion] = useState<any>(null);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // símbolo actual (string) sin importar si selectedStock es string u objeto
  const selectedSymbol: string = typeof selectedStock === 'string'
    ? selectedStock
    : (selectedStock?.symbol ?? 'AAPL');

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
      case 'resumen':
        return (
          <ConclusionRapidaCard 
            stockBasicData={stockBasicData}
            stockAnalysis={stockAnalysis}
            stockConclusion={stockConclusion}
          />
        );
      case 'datos':
        return (
          <DatosTab 
            stockAnalysis={stockAnalysis}
            stockPerformance={stockPerformance}
            stockBasicData={stockBasicData}
            stockReport={stockReport}
          />
        );
      case 'chart':
        return (
          <Dialog open={isChartModalOpen} onOpenChange={setIsChartModalOpen}>
            <DialogContent className="w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh] overflow-y-auto bg-gray-900/95 backdrop-blur-md border border-green-400/30 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-green-400">
                  📈 Charts - {selectedSymbol}
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
      case 'informe':
        return <InformeTab stockReport={stockReport} />;
      case 'estimacion':
        return <EstimacionCard selectedStock={selectedStock} />;
      case 'noticias':
        return <NoticiasTab symbol={selectedSymbol || 'AAPL'} />;
      case 'twits':
        return <TwitsTab />;
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
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode
          ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black text-green-400'
          : 'bg-gradient-to-br from-gray-100 via-white to-gray-50 text-gray-800'
      }`}
    >
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <div className="w-80 flex flex-col p-6 border-r border-green-400/20 bg-black/20">
          <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-green-400/20">
            <Terminal className="w-8 h-8 text-green-400" />
            <h1 className="text-xl font-bold text-green-400">FINTRA</h1>
          </div>

          <div className="flex flex-col space-y-6">
            {/* Hora */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <span className={`font-mono text-sm ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`font-mono text-sm ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <span className="text-green-400 font-semibold">NY</span>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {isMarketOpen() ? 'Market Open' : 'Market Close'}
                </span>
              </div>
            </div>

            <div className="border-t border-green-400/20" />

            {/* Controles */}
            <div className="space-y-3">
              <Button
                onClick={toggleTheme}
                variant="ghost"
                size="sm"
                className="w-full text-gray-300 hover:bg-green-400/10 hover:text-green-400 justify-start transition-colors"
              >
                {isDarkMode ? <Sun className="w-4 h-4 mr-3" /> : <Moon className="w-4 h-4 mr-3" />}
                {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
              </Button>

              <Button
                onClick={handleAuth}
                variant="ghost"
                size="sm"
                className="w-full text-gray-300 hover:bg-green-400/10 hover:text-green-400 justify-start transition-colors"
              >
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {user ? 'Logout' : 'Login'}
              </Button>
            </div>

            <div className="border-t border-green-400/20" />

            {/* Fecha */}
            <div className="flex items-center space-x-3 text-gray-400">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span className="text-sm font-mono">
                {currentTime ? currentTime.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '--/--/--'}
              </span>
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400">
              {error}
            </div>
          )}

          {selectedStock && (
            <>
              {/* Columnas */}
              <div className="flex gap-6">
                {/* Izquierda */}
                <div className="w-2/5 flex flex-col gap-6">
                  {/* Búsqueda */}
                  <div className="w-full">
                    <div className="flex space-x-4 items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
                        <Input
                          type="text"
                          placeholder="Buscar símbolo de acción (ej: AAPL, GOOGL)..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="pl-10 bg-black/50 border-green-400/30 text-green-400 placeholder-green-400/50 focus:border-green-400"
                        />
                      </div>
                      <Button
                        onClick={() => buscarDatosAccion(searchTerm.trim())}
                        disabled={isLoading || !searchTerm.trim()}
                        className="bg-green-400/20 text-green-400 border border-green-400/30 hover:bg-green-400/30 flex-shrink-0"
                      >
                        {isLoading ? 'Buscando...' : 'Buscar'}
                      </Button>
                    </div>
                  </div>

                  {/* Más buscadas */}
                  <div className="flex items-center space-x-2 bg-black/30 border border-green-400/20 rounded-md px-3 py-2">
                    <span className="text-green-400 text-sm font-medium flex-shrink-0">Más buscadas:</span>
                    <div className="flex space-x-1 overflow-x-auto scrollbar-thin min-w-0">
                      <TopSearchedStocksDropdown onStockClick={handleTopStockClick} />
                    </div>
                  </div>

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

                {/* Derecha */}
                <div className="w-3/5 flex flex-col items-center justify-center">
                  <div className="w-full">
                    <RadarPeersCard
                      symbol={selectedSymbol || "NVDA"}
                      companyName={stockBasicData?.companyName}
                      onSelectSymbol={(s) => {
                        setSearchTerm(s);
                        setSelectedStock(s);
                        buscarDatosAccion(s);
                      }}
                    />
                  </div>
                </div>
              </div> {/* ⬅️ cierre del contenedor de columnas */}

              {/* Tabs debajo de las columnas */}
              <div className="w-full mt-6">
                <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
                <div className="mt-6">
                  {renderTabContent()}
                </div>
              </div>
            </>
          )}

          {!selectedStock && (
            <>
              <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
              <div className="mt-6">{renderTabContent()}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
