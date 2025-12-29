import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import TopSearchedStocksDropdown from '@/components/TopSearchedStocksDropdown';
import { Search } from 'lucide-react';
import { SearchResponse } from '@/lib/fmp/types';

interface StockSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbol: (symbol: string) => void;
}

export default function StockSearchModal({ isOpen, onClose, onSelectSymbol }: StockSearchModalProps) {
  const [tickerInput, setTickerInput] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeResultIndex, setActiveResultIndex] = useState<number>(-1);
  const resultsRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
        // slight delay to ensure modal is rendered
        setTimeout(() => inputRef.current?.focus(), 50);
    } else {
        setTickerInput("");
        setSearchResults([]);
        setActiveResultIndex(-1);
    }
  }, [isOpen]);

  // Search logic
  useEffect(() => {
    const q = tickerInput.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let active = true;
    setSearchLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const internal = `/api/fmp/search?query=${encodeURIComponent(q)}&limit=8`;
        const res = await fetch(internal, { signal: controller.signal });
        let data: SearchResponse = [];
        if (res.ok) {
          data = await res.json();
        }
        if (active) setSearchResults(Array.isArray(data) ? data : []);
      } catch (_) {
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [tickerInput]);

  const handleTickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTickerInput(e.target.value.toUpperCase());
    setActiveResultIndex(-1);
  };

  const handleQuickSearchStockClick = (symbol: string) => {
    onSelectSymbol(symbol);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveResultIndex((prev) => {
        const next = prev < 0 ? 0 : Math.min(prev + 1, searchResults.length - 1);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveResultIndex((prev) => {
        const next = prev <= 0 ? -1 : prev - 1;
        return next;
      });
    } else if (e.key === 'Enter') {
      if (activeResultIndex >= 0 && searchResults[activeResultIndex]) {
        e.preventDefault();
        handleQuickSearchStockClick(searchResults[activeResultIndex].symbol);
      } else if (tickerInput.trim()) {
        e.preventDefault();
        handleQuickSearchStockClick(tickerInput.trim());
      }
    } else if (e.key === 'Escape') {
        onClose();
    }
  };
    
    // Auto-scroll to active item
    useEffect(() => {
        const el = resultsRefs.current[activeResultIndex];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [activeResultIndex]);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-fondoDeTarjetas border border-gray-700 p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Buscar Acción</DialogTitle>
        
        <div className="flex items-center border-b border-gray-700 px-3 py-2">
            <Search className="w-5 h-5 text-gray-400 mr-2" />
            <Input
                ref={inputRef}
                value={tickerInput}
                onChange={handleTickerChange}
                onKeyDown={handleKeyDown}
                placeholder="Buscar símbolo... (AAPL, MSFT, AMZN)"
                className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-lg placeholder:text-gray-500 text-white h-12 uppercase shadow-none"
            />
        </div>

        <div className="grid grid-cols-7 divide-x divide-gray-700 bg-gray-900/50 min-h-[300px]">
            {/* Results Column */}
            <div className="col-span-5 flex flex-col">
                <div className="p-2 border-b border-gray-700/50">
                    <span className="text-xs text-gray-400 font-medium px-2">Resultados</span>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[400px] p-1">
                    {searchLoading && (
                        <div className="px-3 py-4 text-sm text-gray-400 flex items-center justify-center">
                            <span className="animate-pulse">Buscando...</span>
                        </div>
                    )}
                    {!searchLoading && searchResults.length === 0 && tickerInput.trim().length >= 2 && (
                        <div className="px-3 py-4 text-sm text-gray-500 text-center">Sin resultados</div>
                    )}
                    {!searchLoading && searchResults.length === 0 && tickerInput.trim().length < 2 && (
                         <div className="px-3 py-10 text-sm text-gray-600 text-center flex flex-col items-center gap-2">
                            <Search className="w-8 h-8 opacity-20" />
                            <span>Escribe el ticker o nombre de la empresa</span>
                        </div>
                    )}
                    {searchResults.map((r, idx) => (
                        <button
                            ref={(el) => { if (resultsRefs.current) resultsRefs.current[idx] = el; }}
                            key={`${r.symbol}-${r.name}`}
                            className={`w-full text-left px-3 py-2.5 rounded transition-colors ${idx === activeResultIndex ? 'bg-gray-800/80' : 'hover:bg-gray-800/40'}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActiveResultIndex(idx)}
                            onClick={() => handleQuickSearchStockClick(r.symbol)}
                        >
                            <div className="flex justify-between items-center mb-0.5">
                                <span className="text-sm text-[#FFA028] font-mono font-bold">{r.symbol}</span>
                                <span className="text-[10px] text-gray-500 border border-gray-700 px-1 rounded">{r.exchangeShortName || "N/A"}</span>
                            </div>
                            <div className="text-xs text-gray-300 truncate">{r.name}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Top Searched Column */}
            <div className="col-span-2 bg-gray-900/80">
                <div className="p-2 border-b border-gray-700/50">
                    <span className="text-xs text-gray-400 font-medium">Más buscadas</span>
                </div>
                <div className="p-1">
                    <TopSearchedStocksDropdown 
                        onStockClick={handleQuickSearchStockClick} 
                        isMobile={false}
                        isQuickSearch={true}
                    />
                </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
