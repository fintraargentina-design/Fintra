"use client";

import { useState, useEffect, KeyboardEvent, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { searchStocks, registerPendingStock, UnifiedSearchResult } from "@/lib/services/search-service";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";

export default function GlobalSearchInput({ onSelect }: { onSelect?: (ticker: string) => void }) {
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
        setResults(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;

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
      } else if (results.length > 0) {
        // Default to first result if none selected
        handleSelect(results[0]);
      }
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
        <div className="relative w-full max-w-[180px] pb-0">
          <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-500" />
          <Input 
            placeholder="Buscar ticker..." 
            className="h-6 pl-7 text-[10px] bg-zinc-900 border-zinc-800 focus-visible:ring-0 focus-visible:ring-transparent placeholder:text-gray-600 text-gray-200 rounded-none"
            value={query}
            onChange={e => {
                setQuery(e.target.value);
                if (e.target.value.length >= 2) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length >= 2 && setOpen(true)}
          />
          {loading && <Loader2 className="absolute right-2 top-1.5 h-3 w-3 animate-spin text-gray-500" />}
        </div>
      </PopoverAnchor>
      
      <PopoverContent 
        className="p-0 w-[500px] bg-[#121212] border-zinc-800 shadow-xl rounded-none" 
        align="start" 
        sideOffset={5}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
           {loading && results.length === 0 ? (
              <div className="p-3 text-[10px] text-gray-500 text-center flex items-center justify-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
              </div>
           ) : results.length === 0 ? (
              <div className="p-3 text-[10px] text-gray-500 text-center">
                 No se encontraron resultados
              </div>
           ) : (
             <div 
               ref={listRef}
               className="max-h-[350px] w-full overflow-y-auto scrollbar-thin"
             >
                {results.map((stock, index) => (
                  <div 
                    key={`${stock.ticker}-${stock.source}`}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-zinc-800/50 last:border-0 group transition-colors ${
                      index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    onClick={() => handleSelect(stock)}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-light text-white text-xs font-mono">{stock.ticker}</span>
                        {/* {stock.source === 'local' ? (
                           <span className="text-[8px] bg-blue-500/10 text-blue-400 px-1 rounded-none border border-blue-500/20">DB</span>
                        ) : (
                           <span className="text-[8px] bg-yellow-500/10 text-yellow-400 px-1 rounded-none border border-yellow-500/20">FMP</span>
                        )} */}
                      </div>
                      <div className="text-[12px] text-gray-400 font-mono font-light truncate group-hover:text-white">{stock.name}</div>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono shrink-0 border border-zinc-800 px-1 rounded-none bg-black/20">
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
