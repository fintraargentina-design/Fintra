"use client";

import { useState, useEffect, KeyboardEvent, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { FintraLoader } from "@/components/ui/FintraLoader";
import { useRouter } from "next/navigation";
import { searchStocks, registerPendingStock, UnifiedSearchResult } from "@/lib/services/search-service";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";

export default function GlobalSearchInput({ onSelect, className }: { onSelect?: (ticker: string) => void, className?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  
  const listRef = useRef<HTMLDivElement>(null);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Scroll to selected item
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);
  
  // ... existing logic ...

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([]);
        setOpen(false); 
        return;
      }
      
      setLoading(true);
      setOpen(true);
      try {
        const data = await searchStocks(query);
        
        // Sort to prioritize US markets (NASDAQ, NYSE, AMEX)
        const sorted = [...data].sort((a, b) => {
           const isUS = (ex: string) => {
              if (!ex) return false;
              const U = ex.toUpperCase();
              return U.includes("NASDAQ") || U.includes("NYSE") || U.includes("AMEX") || U.includes("NEW YORK");
           };
           
           const usA = isUS(a.exchange);
           const usB = isUS(b.exchange);
           
           if (usA && !usB) return -1;
           if (!usA && usB) return 1;
           return 0;
        });

        setResults(sorted);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
        return;
      }

      if (!query.trim()) {
        return;
      }

      const q = query.trim().toLowerCase();

      const exactTicker = results.find(r => r.ticker.toLowerCase() === q);
      if (exactTicker) {
        handleSelect(exactTicker);
        return;
      }

      const exactName = results.find(r => (r.name || '').toLowerCase() === q);
      if (exactName) {
        handleSelect(exactName);
        return;
      }

      // Fallback: assume user typed a ticker if no results found
      const fallbackTicker = query.trim().toUpperCase();
      handleSelect({
        ticker: fallbackTicker,
        name: fallbackTicker,
        exchange: '',
        currency: '',
        source: 'local' as const
      });
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleSelect = async (stock: UnifiedSearchResult) => {
    setQuery("");
    setOpen(false);
    
    if (stock.source === 'fmp') {
       // Mark as pending / Insert
       try {
          await registerPendingStock(stock);
       } catch (e) {
          console.error("Failed to register pending stock", e);
       }
    }
    
    if (onSelect) {
       onSelect(stock.ticker);
    } else {
       router.push(`/company/${stock.ticker}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={`relative w-full ${className || 'max-w-[300px]'} pb-0`}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666]" />
          <Input 
            placeholder="Buscar ticker..." 
            className="h-8 py-0 pl-9 text-xs bg-[#0A0A0A] uppercase border border-[#333]  placeholder:text-[#666] text-[#EDEDED] font-medium search-input-vscode shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-[#333] !caret-[#EDEDED]"
            value={query}
            onChange={e => {
                setQuery(e.target.value);
                if (e.target.value.length >= 2) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setOpen(true)}
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
               <FintraLoader size={16} />
            </div>
          )}
        </div>
      </PopoverAnchor>
      
      <PopoverContent 
        className="p-0 w-[300px] bg-dark-card border-divider shadow-xl rounded-sm mt-1" 
        align="start" 
        sideOffset={5}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
           {loading && results.length === 0 ? (
              <div className="p-3 text-[10px] text-gray-500 text-center flex items-center justify-center gap-2">
                <FintraLoader size={12} /> Buscando...
              </div>
           ) : results.length === 0 ? (
              <div className="p-3 text-[10px] text-gray-500 text-center">
                 No se encontraron resultados
              </div>
           ) : (
             <div
               ref={listRef}
               className="max-h-[350px] w-full overflow-y-auto"
             >
                {results.map((stock, index) => (
                  <div 
                    key={`${stock.ticker}-${stock.source}`}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-divider/50 last:border-0 group transition-colors ${
                      index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    onClick={() => handleSelect(stock)}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-text-primary text-xs font-mono">{stock.ticker}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium truncate group-hover:text-text-primary">{stock.name}</div>
                    </div>
                    <div className="text-[9px] text-gray-500 font-mono shrink-0 px-1">
                        {stock.exchange}
                    </div>
                  </div>
                ))}
             </div>
           )}
      </PopoverContent>
    </Popover>
  );
}
