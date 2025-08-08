'use client';

import { useState, useEffect } from 'react';
import { searchStockData, getStockConclusionData } from '@/lib/stockQueries';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Activity, Search, Terminal, Sun, Moon, ChevronDown, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartTab from '@/components/tabs/ChartTab';
import InformeTab from '@/components/tabs/InformeTab';
import EstimacionTab from '@/components/tabs/EstimacionTab';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import TwitsTab from '@/components/tabs/TwitsTab';
import TopSearchedStocks from '@/components/TopSearchedStocks';
import MarketClock from '@/components/MarketClock';
import { supabase, registerStockSearch } from '@/lib/supabase';
import RadarChart from "@/components/charts/RadarChart";
import TopSearchedStocksDropdown from '@/components/TopSearchedStocksDropdown';
import { getConclusionColors } from '@/lib/conclusionColors';
import ConclusionRapidaCard from '@/components/cards/ConclusionRapidaCard';
import OverviewCard from '@/components/cards/OverviewCard';
import EstimacionCard from '@/components/cards/EstimacionCard';

export default function StockTerminal() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockBasicData, setStockBasicData] = useState(null);
  const [stockAnalysis, setStockAnalysis] = useState(null);
  const [stockPerformance, setStockPerformance] = useState(null);
  const [stockReport, setStockReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('estimacion');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user, setUser] = useState(null);
  const [stockConclusion, setStockConclusion] = useState(null);
  // Agregar estos estados para el reloj
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Agregar useEffect para el reloj
  useEffect(() => {
    setIsClient(true);
    setCurrentTime(new Date());
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Función para verificar si el mercado está abierto
  const isMarketOpen = () => {
    if (!currentTime) return false;
    
    const nyTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const day = nyTime.getDay();
    const hour = nyTime.getHours();
    const minute = nyTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    if (day === 0 || day === 6) {
      return false;
    }
    
    const marketOpen = 9 * 60 + 30;
    const marketClose = 16 * 60;
    
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
  };

  // Función para alternar el tema
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Modificar la función buscarDatosAccion
  const buscarDatosAccion = async (symbol: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Registrar la búsqueda
      await registerStockSearch(symbol);
      
      // Pasar activeTab a searchStockData
      const result = await searchStockData(symbol, activeTab);
      
      if (result.success) {
        setStockBasicData(result.basicData);
        setStockAnalysis(result.analysisData);
        setStockPerformance(result.performanceData);
        setStockReport(result.reportData);
        setSelectedStock(result.basicData);
        
        // Solo obtener conclusión si no es pestaña noticias
        if (activeTab !== 'noticias') {
          const conclusionData = await getStockConclusionData(symbol);
          setStockConclusion(conclusionData);
        }
      } else {
        setError(result.error || 'Error al buscar datos');
      }
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setError('Error al buscar datos de la acción');
    } finally {
      setIsLoading(false);
    }
  };
  

  // Manejar búsqueda con Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      buscarDatosAccion(searchTerm.trim());
    }
  };

  // Función para formatear números
  const formatNumber = (num) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  // Función para formatear porcentajes
  const formatPercentage = (num) => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  // Función para renderizar el contenido de cada tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'datos':
        return <DatosTab stockAnalysis={stockAnalysis} stockPerformance={stockPerformance} stockBasicData={stockBasicData} stockReport={stockReport} />;
      case 'chart':
        return <ChartTab 
          selectedStock={selectedStock} 
          stockBasicData={stockBasicData}
          stockAnalysis={stockAnalysis}
        />;
      case 'informe':
        return <InformeTab stockReport={stockReport} />;
      case 'estimacion':
        return <EstimacionCard selectedStock={selectedStock} />
      case 'noticias':
        return <NoticiasTab symbol={selectedStock?.symbol || 'AAPL'} /> // ✅ Solo pasar el símbolo
      case 'twits':
        return <TwitsTab />;
      default:
        return <DatosTab stockAnalysis={stockAnalysis} stockPerformance={stockPerformance} stockBasicData={stockBasicData} />;
    }
  };

  // Función para manejar autenticación
  const handleAuth = async () => {
    if (user) {
      // Si está logueado, hacer logout
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error al cerrar sesión:', error);
      } else {
        setUser(null);
      }
    } else {
      // Si no está logueado, redirigir a login/signup
      // Aquí puedes implementar un modal o redirigir a una página de auth
      console.log('Redirigir a login/signup');
    }
  };

  // Función para manejar click en acciones más buscadas 
  const handleTopStockClick = (symbol: string) => {
    setSearchTerm(symbol);
    buscarDatosAccion(symbol);
  };

  // Verificar estado de autenticación al cargar
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    getSession();
    
    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );
    
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-black text-green-400' 
        : 'bg-gradient-to-br from-gray-100 via-white to-gray-50 text-gray-800'
      }`}>
      
      {/* Layout principal con sidebar y contenido */}
      <div className="flex min-h-screen">
        {/* Header/Sidebar a la izquierda */}
        <div className="w-80 flex flex-col p-6 border-r border-green-400/20 bg-black/20">
          {/* Logo y título */}
          <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-green-400/20">
            <Terminal className="w-8 h-8 text-green-400" />
            <h1 className="text-xl font-bold text-green-400">FINTRA</h1>
          </div>
          
          {/* Menú vertical organizado */}
          <div className="flex flex-col space-y-6">
            {/* Información de tiempo */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                
                <span className={`font-mono text-sm ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime ? currentTime.toLocaleTimeString('es-ES', { 
                    hour12: false,
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  }) : '--:--:--'}
                </span>
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>

              <div className="flex items-center space-x-3">
                
                <span className={`font-mono text-sm ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime ? currentTime.toLocaleTimeString('en-US', { 
                    timeZone: 'America/New_York',
                    hour12: false,
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  }) : '--:--:--'}
                </span>
                <span className="text-green-400 font-semibold">NY</span>
              </div>

              
              <div className="flex items-center space-x-3">
                {/* <span className="text-lg">
                  {isMarketOpen() ? '🟢' : '🔴'}
                </span> */}
                <span className={`text-sm font-medium ${
                  isMarketOpen() ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isMarketOpen() ? 'Market Open' : 'Market Close'}
                </span>
              </div>
            </div>
            
            {/* Separador */}
            <div className="border-t border-green-400/20"></div>
            
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
            
            {/* Separador */}
            <div className="border-t border-green-400/20"></div>
            
            {/* Fecha */}
            <div className="flex items-center space-x-3 text-gray-400">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span className="text-sm font-mono">
                {currentTime ? currentTime.toLocaleDateString('es-ES', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: '2-digit' 
                }) : '--/--/--'}
              </span>
            </div>
          </div>
        </div>
      
      {/* Contenido principal a la derecha */}
      <div className="flex-1 p-6">
        {/* Barra de Busqueda */}
        <div className="flex justify-between items-center space-x-4 mb-6">
          <div className="flex space-x-4 items-center">
            <div className="relative">
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
              className="bg-green-400/20 text-green-400 border border-green-400/30 hover:bg-green-400/30"
            >
              {isLoading ? 'Buscando...' : 'Buscar'}
            </Button>
            
            {/* Acciones más buscadas como componente fijo */}
            <div className="flex items-center space-x-2 bg-black/30 border border-green-400/20 rounded-md px-3 py-2">
              <span className="text-green-400 text-sm font-medium">Más buscadas:</span>
              <div className="flex space-x-1">
                <TopSearchedStocksDropdown onStockClick={handleTopStockClick} />
              </div>
            </div>
          </div>
          {/* Botón Analizadores alineado a la derecha */}
          <Button 
            className="bg-green-400/20 text-green-400 border border-green-400/30 hover:bg-green-400/30 px-6"
          >
            Analizadores
          </Button>
        </div>
      
        {/* Mostrar error si existe */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-400">
            {error}
          </div>
        )}

        {/* Información de la acción seleccionada */}
        {selectedStock && (
          <>
            {/* Contenedor de columnas */}
            <div className="flex gap-6"> 
              {/* COLUMNA IZQUIERDA */}
              <div className="w-2/5 flex flex-col gap-6">
                <div className="space-y-4">                   
                  <OverviewCard 
                    stockBasicData={stockBasicData}
                    stockAnalysis={stockAnalysis}
                    selectedStock={selectedStock}
                  />
                </div>
                
                <div className="mb-6 flex">
                  <div className="w-full">
                    <ConclusionRapidaCard stockConclusion={stockConclusion} />
                  </div>
                </div>
              </div>
              
              {/* COLUMNA DERECHA */}
              <div className="w-3/5 flex flex-col items-center justify-center">
                <div className="w-full flex items-center justify-center gap-6">
                  <RadarChart 
                    stockBasicData={stockBasicData}
                    stockAnalysis={stockAnalysis}
                  />
                </div>
              </div>
            </div>

            {/* Tabs fuera de las columnas */}
            <div className="w-full mt-6">
              <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
              <div className="mt-6">
                {renderTabContent()}
              </div>
            </div>
          </>
        )}


        {/* Si no hay stock seleccionado, mostrar nav y contenido normalmente */}
        {!selectedStock && (
          <>
            {/* Navegación de tabs */}
            <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
            
            {/* Contenido de tabs */}
            <div className="mt-6">
              {renderTabContent()}
            </div>
          </>
        )}
      </div>
    </div>
  </div>
  );
}
