import { Settings, Flame, ChevronDown, TextCursorInput, Clock, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect, useRef } from 'react';
import TopSearchedStocksDropdown from '@/components/TopSearchedStocksDropdown';
import { useResponsive } from '@/hooks/use-responsive';
import { Card } from '@/components/ui/card';
import NavigationBar from '@/components/layout/NavigationBar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  user?: any;
  onAuth?: () => void;
  onSelectSymbol: (symbol: string) => void;
  showTimes?: boolean;
  activeTab: any;
  setActiveTab: (tab: any) => void;
  symbol: string;
  fundamentalData?: any;
  valoracionData?: any;
  financialScoresData?: any;
  overviewData?: any;
  estimacionData?: any;
  dividendosData?: any;
  desempenoData?: any;
}

export default function Header({ user, onAuth, onSelectSymbol, showTimes = true, activeTab, setActiveTab, symbol, fundamentalData, valoracionData, financialScoresData, overviewData, estimacionData, dividendosData, desempenoData }: HeaderProps) {
  const { isMobile } = useResponsive();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showTimesEnabled, setShowTimesEnabled] = useState(showTimes);
  
  // Estados para el input de búsqueda
  const [tickerInput, setTickerInput] = useState("");
  const [isTickerFocused, setIsTickerFocused] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const id = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isMarketOpen = () => {
    if (!currentTime) return false;
    const nyTime = new Date(currentTime.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = nyTime.getDay();
    const minutes = nyTime.getHours() * 60 + nyTime.getMinutes();
    if (day === 0 || day === 6) return false;
    return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  };

  const handleTopStockClick = (symbol: string) => {
    onSelectSymbol?.(symbol);
  };

  const toggleTimeDisplay = () => {
    setShowTimesEnabled((prev) => !prev);
  };

  // Funciones para el input de búsqueda
  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setTickerInput(value);
  };
  
  const handleTickerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tickerInput.trim()) {
      handleTopStockClick(tickerInput.trim());
      setShowQuickSearch(false);
    }
    if (e.key === 'Escape') {
      setShowQuickSearch(false);
      setIsTickerFocused(false);
    }
  };
  
  const handleTickerFocus = () => {
    setIsTickerFocused(true);
    setShowQuickSearch(true);
  };
  
  const handleTickerBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay hiding to allow clicking on dropdown items
    setTimeout(() => {
      if (!searchContainerRef.current?.contains(document.activeElement)) {
        setIsTickerFocused(false);
        setShowQuickSearch(false);
      }
    }, 150);
  };

  const handleQuickSearchStockClick = (symbol: string) => {
    setTickerInput(symbol);
    setShowQuickSearch(false);
    setIsTickerFocused(false);
    handleTopStockClick(symbol);
  };

  return (
    <header className="w-full">
      <div className="flex items-center justify-between">
        {/* Lado izquierdo - Título */}
        <div className="flex items-center space-x-2 flex-1 ml-4">
          <h1 className="text-lg font-medium text-white">
            Dashboard - Bienvenido a Fintra
          </h1>
        </div>

        {/* Centro - Input de búsqueda con dropdown de sugerencias */}
        <div className="flex items-center justify-center flex-1 space-x-4">
          {/* Input de búsqueda de símbolos con dropdown */}
          <div ref={searchContainerRef} className="relative flex items-center gap-2">
            <Input
              /* value={tickerInput} */
              onChange={handleTickerChange}
              onKeyDown={handleTickerKeyDown}
              onFocus={handleTickerFocus}
              onBlur={handleTickerBlur}
              placeholder="Buscar símbolo..."
              className="focus:placeholder:text-transparent bg-transparent border border-gray-600 outline-none text-orange-400 text-sm font-medium cursor-text transition-colors w-80 h-8"
            />
            
            {/* Dropdown de búsqueda rápida */}
            {showQuickSearch && (
              <div className="absolute top-full  mt-1 w-80 bg-fondoDeTarjetas border border-gray-700  shadow-lg z-50 max-h-64 overflow-y-auto">
                <div className="p-2 border-b border-gray-700">
                  <span className="text-xs text-gray-400 font-medium">Más buscadas</span>
                </div>
                <div className="py-1">
                  <TopSearchedStocksDropdown 
                    onStockClick={handleQuickSearchStockClick} 
                    isMobile={false}
                    isQuickSearch={true}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Separador */}
          <div className="h-6 w-px bg-gray-600"></div>
          {/* Navigation Bar responsiva */}
          <div className="lg:min-w-[350px]">
            <Card className="flex justify-end bg-transparent border-none">
              <div className="p-2">
                <NavigationBar 
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  symbol={symbol}
                  fundamentalData={fundamentalData || null}
                  valoracionData={valoracionData || null}
                  financialScoresData={financialScoresData || null}
                  overviewData={overviewData}
                  estimacionData={estimacionData || null}
                  dividendosData={dividendosData || null}
                  desempenoData={desempenoData || null}
                />
              </div>
            </Card>
          </div>
        </div>

        {/* Lado derecho - Controles */}
        <div className="flex items-center space-x-6 flex-1 justify-end">
          
          {/* Horarios - Solo se muestran si showTimes es true */}
          {showTimesEnabled && (
            <>
              {/* Tiempo Local */}
              <div className="flex items-center space-x-2 text-sm">
                <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>

              {/* Tiempo NY */}
              <div className="flex items-center space-x-2 text-sm">
                <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <span className="text-orange-400 font-semibold">NY</span>
              </div>
            </>
          )}

          {/* Estado del Mercado - Ahora es clickeable */}
          <div 
            className="flex items-center space-x-2 text-sm cursor-pointer hover:opacity-80 transition-opacity"
            onClick={toggleTimeDisplay}
          >
            <span className={`font-medium ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
              {isMarketOpen() ? 'Market Open' : 'Market Close'}
            </span>
          </div>

          {/* Separador vertical */}
          <div className="h-5 w-px bg-gray-700"></div>

          {/* Configuración */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-gray-400 mr-4 hover:text-white hover:bg-gray-800 p-2"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}