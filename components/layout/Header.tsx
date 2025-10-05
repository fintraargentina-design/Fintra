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
  const placeholderText = "Buscar símbolo... (AAPL, MSFT, AMZN)";
  const inputRef = useRef<HTMLInputElement>(null);
  const [maxWidthPx, setMaxWidthPx] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const style = window.getComputedStyle(el);
    const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = font;
    const text = (el.placeholder || placeholderText).toUpperCase();
    const metrics = ctx.measureText(text);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const total = Math.ceil(metrics.width + paddingLeft + paddingRight + borderLeft + borderRight);
    setMaxWidthPx(total);
  }, [placeholderText]);

  // Estados para el input de búsqueda
  const [tickerInput, setTickerInput] = useState("");
  const [isTickerFocused, setIsTickerFocused] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);

  // NUEVO: estados de búsqueda FMP
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; exchangeShortName?: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const q = tickerInput.trim();
    if (!isTickerFocused || q.length < 2) {
      setSearchResults([]);
      return;
    }
    let active = true;
    setSearchLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        // Intenta usar la ruta interna si existe
        const internal = `/api/fmp/search?query=${encodeURIComponent(q)}&limit=8`;
        const res = await fetch(internal, { signal: controller.signal });
        let data: any[] = [];
        if (res.ok) {
          data = await res.json();
        } else if (process.env.NEXT_PUBLIC_FMP_API_KEY) {
          // Fallback directo a FMP si no hay route
          const ext = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&limit=8&apikey=${process.env.NEXT_PUBLIC_FMP_API_KEY}`;
          const r2 = await fetch(ext, { signal: controller.signal });
          if (r2.ok) data = await r2.json();
        }
        if (active) setSearchResults(Array.isArray(data) ? data : []);
      } catch (_) {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250); // debounce
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [tickerInput, isTickerFocused]);
  const searchContainerRef = useRef<HTMLInputElement | HTMLDivElement>(null as any);

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
    setShowQuickSearch(true);
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
      <div className="w-full flex flex-wrap items-center justify-between gap-2 md:gap-3 px-4 py-2 md:py-3">
        {/* Izquierda: botón + título */}
        <div className="flex items-center gap-2 flex-[1_1_220px] min-w-0">          
          <h1 className="text-lg font-medium text-white truncate">
            Fintra - Dashboard 
          </h1>
        </div>

        {/* Centro: buscador + tabs */}
        <div className="flex items-center justify-center gap-2 flex-[2_1_420px] min-w-0">
          <div
            ref={searchContainerRef}
            className="relative flex items-center gap-2 flex-1 min-w-0"
            /* style={{ maxWidth: maxWidthPx ? `${maxWidthPx}px` : undefined }} */
            style={{ maxWidth: "500px" }}
          >
            <Input
              ref={inputRef}
              onChange={handleTickerChange}
              onKeyDown={handleTickerKeyDown}
              onFocus={handleTickerFocus}
              onBlur={handleTickerBlur}
              placeholder={placeholderText}
              className="focus:placeholder:text-transparent bg-tarjetas border border-gray-600 outline-none text-orange-400 text-sm font-medium transition-colors w-full h-9 md:h-10 focus-visible:ring-1 focus-visible:ring-orange-500 focus-visible:ring-offset-0 uppercase"
            />
            {showQuickSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-fondoDeTarjetas border border-gray-700 shadow-lg z-50 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-7 divide-x divide-gray-700">
                  {/* Columna 1: Resultados (5/7) */}
                  <div className="col-span-5">
                    <div className="p-2">  {/* border-b border-gray-700 */}
                      <span className="text-xs text-gray-400 font-medium">Resultados</span>
                    </div>
                    <div className="py-1">
                      {searchLoading && (
                        <div className="px-3 py-2 text-xs text-gray-400">Buscando...</div>
                      )}
                      {!searchLoading && searchResults.length === 0 && tickerInput.trim().length >= 2 && (
                        <div className="px-3 py-2 text-xs text-gray-500">Sin resultados</div>
                      )}
                      {searchResults.map((r) => (
                        <button
                          key={`${r.symbol}-${r.name}`}
                          className="w-full text-left px-3 py-2 hover:bg-gray-800/40 transition-colors"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleQuickSearchStockClick(r.symbol)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-orange-400 font-mono">{r.symbol}</span>
                            <span className="text-xs text-gray-500">{r.exchangeShortName || ""}</span>
                          </div>
                          <div className="text-xs text-gray-300 truncate">{r.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Columna 2: Más buscadas (2/7) */}
                  <div className="col-span-2">
                    <div className="p-2">
                      <span className="text-xs text-gray-400 font-medium">Top</span>
                    </div>
                    <div className="py-1">
                      <TopSearchedStocksDropdown 
                        onStockClick={handleQuickSearchStockClick} 
                        isMobile={false}
                        isQuickSearch={true}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="hidden">
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

        {/* Derecha: tiempos y estado del mercado */}
        <div className="flex items-center gap-4 flex-[1_1_240px] justify-end min-w-0">
          {showTimesEnabled && (
            <>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('es-ES', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className={`font-mono ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
                  {currentTime
                    ? currentTime.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--:--'}
                </span>
                <span className="text-orange-400 font-semibold">NY</span>
              </div>
            </>
          )}

          <div 
            className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80 transition-opacity"
            onClick={toggleTimeDisplay}
          >
            <span className={`font-medium ${isMarketOpen() ? 'text-green-400' : 'text-red-400'}`}>
              {isMarketOpen() ? 'Market Open' : 'Market Close'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}