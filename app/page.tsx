'use client';

import { useState, useEffect } from 'react';
import { searchStockData } from '@/lib/stockQueries';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, TrendingUp, TrendingDown, Activity, Search, Terminal, Sun, Moon } from 'lucide-react';
import NavigationBar from '@/components/layout/NavigationBar';
import DatosTab from '@/components/tabs/DatosTab';
import ChartTab from '@/components/tabs/ChartTab';
import InformeTab from '@/components/tabs/InformeTab';
import EstimacionTab from '@/components/tabs/EstimacionTab';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import TwitsTab from '@/components/tabs/TwitsTab';
import TopSearchedStocks from '@/components/TopSearchedStocks';
import { supabase, registerStockSearch } from '@/lib/supabase';
import RadarChart from "@/components/charts/RadarChart";


export default function StockTerminal() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStock, setSelectedStock] = useState('AAPL');
  const [stockBasicData, setStockBasicData] = useState(null);
  const [stockAnalysis, setStockAnalysis] = useState(null);
  const [stockPerformance, setStockPerformance] = useState(null);
  const [stockReport, setStockReport] = useState(null); // Nuevo estado
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('datos');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user, setUser] = useState(null);

  // Función para buscar datos de una acción
  // Importar la nueva función
  
  
  // Modificar la función buscarDatosAccion
  const buscarDatosAccion = async (symbol) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Registrar la búsqueda
      await registerStockSearch(symbol);
      
      const result = await searchStockData(symbol);
      
      if (result.success) {
        setStockBasicData(result.basicData);
        setStockAnalysis(result.analysisData);
        setStockPerformance(result.performanceData);
        setStockReport(result.reportData);
        setSelectedStock(result.basicData);
      } else {
        setError(result.error || 'Error al buscar datos');
        setStockBasicData(fallbackStockData);
        setSelectedStock(fallbackStockData);
      }
    } catch (err) {
      console.error('Error al buscar datos:', err);
      setError(`Error: ${err.message}`);
      setStockBasicData(fallbackStockData);
      setSelectedStock(fallbackStockData);
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
        return <EstimacionTab />;
      case 'noticias':
        return <NoticiasTab />;
      case 'twits':
        return <TwitsTab />;
      default:
        return <DatosTab stockAnalysis={stockAnalysis} stockPerformance={stockPerformance} stockBasicData={stockBasicData} />;
    }
  };

  // Efecto para aplicar el tema
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [isDarkMode]);

  // Función para cambiar tema
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
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

    const isMarketOpen = () => {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const day = nyTime.getDay(); // 0 = Domingo, 6 = Sábado
    const hour = nyTime.getHours();
    const minute = nyTime.getMinutes();
    const timeInMinutes = hour * 60 + minute;
    
    // Mercado cerrado los fines de semana
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Horario del mercado: 9:30 AM - 4:00 PM EST/EDT
    const marketOpen = 9 * 60 + 30; // 9:30 AM
    const marketClose = 16 * 60; // 4:00 PM
    
    return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
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
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b border-green-400/20">
        <div className="flex items-center space-x-4">
          <Terminal className="w-8 h-8 text-green-400" />
          <h1 className="text-2xl font-bold text-green-400">FINTRA - IA Bursátil</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">
              {new Date().toLocaleDateString('es-ES', { 
                day: '2-digit', 
                month: '2-digit', 
                year: '2-digit' 
              })} - 
            </span>
            <svg className="w-4 h-4" fill="gray" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className={`text-sm font-mono ${
              isMarketOpen() 
                ? 'text-green-400' 
                : 'text-red-400'
            }`}>
              {new Date().toLocaleTimeString('es-ES', { 
                hour12: false,
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}, NY {new Date().toLocaleTimeString('en-US', { 
                timeZone: 'America/New_York',
                hour12: false,
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })} {isMarketOpen() ? '🟢 Open Market' : '🔴 Close Market'}
            </span>
          </div>
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:bg-green-400/10"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          
          <Button
            onClick={handleAuth}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:bg-green-400/10"
          >
            {user ? 'Logout' : 'Login'}
          </Button>
        </div>
      </div>

      <div className="p-6">
        
       
        {/* Barra de Busqueda */}
        <div className="flex justify-between items-center space-x-4 mb-6">
          <div className="flex space-x-4">
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
          <div className="flex gap-6">
            <div className="w-1/4 flex flex-col gap-6">
              <div className="mb-6">
                <Card className="bg-gray-900/50 border-green-400/20">
                  <CardHeader>
                    <CardTitle className="text-green-400 flex items-center justify-between">
                      <span>{selectedStock.symbol} - {selectedStock.company_name || selectedStock.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold">${selectedStock.current_price || selectedStock.price}</span>
                        {selectedStock.change !== undefined && (
                          <span className={`text-sm ${
                            selectedStock.change >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {formatPercentage(selectedStock.change)}
                          </span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Dividir en exactamente dos columnas principales */}
                    <div className="flex gap-6">
                      {/* COLUMNA DERECHA - Información adicional */}
                      <div>
                        <div className="space-y-4">                    
                          {/* Descripción del negocio */}
                          <div>
                            <div className="text-sm text-gray-300 leading-relaxed">
                              {selectedStock.description || 'N/A'}
                            </div>
                          </div>
                          {/* Sitio web */}
                          <div>
                            {selectedStock.website ? (
                              <a 
                                href={selectedStock.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-green-400 hover:text-green-300 underline"
                              >
                                {selectedStock.website}
                              </a>
                            ) : (
                              <div className="text-sm text-green-400">N/A</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              
              
              {/* Reemplazar el div de acciones populares con el nuevo componente */}
              <div>
                <TopSearchedStocks onStockClick={handleTopStockClick} />
              </div>
            </div>
            
            {/* Contenedor para nav y contenido de tabs */}
            <div className="w-3/4 flex flex-col">
            {/* Nuevo div con conclusión semáforo */}
              <div className="mb-6 flex">
                <div>
                  <Card className="w-4/5 bg-gray-900/50 border-green-400/20 gap-6">
                    <CardHeader>
                      <CardTitle className="text-green-400">
                        Conclusión rápida (estilo semáforo)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                          <span className="text-2xl">🟢</span>
                          <div className="text-sm text-gray-300 leading-relaxed">
                            <strong className="text-green-400">Sí, parece una buena acción.</strong> Entiendo el negocio, tiene ventaja competitiva, gana plata, crece y no está cara.
                          </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                          <span className="text-2xl">🟡</span>
                          <div className="text-sm text-gray-300 leading-relaxed">
                            <strong className="text-yellow-400">Podría ser, pero investigá más.</strong> Hay dudas en crecimiento o precio.
                          </div>
                        </div>
                        
                        <div className="flex space-x-3">
                          <span className="text-2xl">🔴</span>
                          <div className="text-sm text-gray-300 leading-relaxed">
                            <strong className="text-red-400">No es buena ahora.</strong> No la entiendo, no gana plata o está demasiado cara.
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* Radar Chart al lado de la conclusión */}
                <div className="w-90 flex items-start gap-6">
                  <RadarChart 
                    stockBasicData={stockBasicData}
                    stockAnalysis={stockAnalysis}
                  />
                </div>
              </div>
              {/* Navegación de tabs */}
              <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} />
              
              {/* Contenido de tabs */}
              <div className="mt-6">
                {renderTabContent()}
              </div>
            </div>
          </div>
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
  );
}
