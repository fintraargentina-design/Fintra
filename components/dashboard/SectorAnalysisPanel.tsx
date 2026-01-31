"use client";
// Fintra/components/dashboard/SectorAnalysisPanel.tsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import TablaIFS, { EnrichedStockData, sortStocksBySnapshot, mapSnapshotToStockData } from "./TablaIFS";
import { MOCK_DATA } from "./mock-data";

interface SectorAnalysisPanelProps {
  onStockSelect?: (symbol: string) => void;
  selectedTicker?: string;
  sectors?: string[];
  selectedSector?: string;
  industries?: string[];
  selectedIndustry?: string;
  selectedExchange?: string;
}

export default function SectorAnalysisPanel({ 
  onStockSelect, 
  selectedTicker,
  sectors = [],
  selectedSector,
  industries = [],
  selectedIndustry = "Todas",
  selectedExchange
}: SectorAnalysisPanelProps) {

  const [stocks, setStocks] = useState<EnrichedStockData[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 1000;

  // Scroll Ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // MOCK MODE TOGGLE
  const USE_MOCK = false;

  // Fetch Data Function
  const fetchData = async (pageNum: number, isNewFetch: boolean) => {
    if (!selectedSector) return;
    
    const currentIndustry = selectedIndustry;
    
    if (isNewFetch) {
        setLoading(true);
        setStocks([]);
    } else {
        setIsFetchingMore(true);
    }
    
    // MOCK DATA RETURN
    if (USE_MOCK) {
        setTimeout(() => {
            // Filter MOCK_DATA slightly to simulate different sectors if needed, 
            // or just return all of it for demo purposes.
            // Let's return all MOCK_DATA sorted by score for better visuals
            const sortedMock = [...MOCK_DATA].sort((a, b) => (b.fgosScore || 0) - (a.fgosScore || 0));
            setStocks(sortedMock);
            setLoading(false);
            setIsFetchingMore(false);
            setHasMore(false);
        }, 600);
        return;
    }

    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data: snapshots, error } = await supabase
        .from('fintra_snapshots')
        .select('*')
        .eq('sector', selectedSector)
        .order('snapshot_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (!snapshots || snapshots.length === 0) {
           setHasMore(false);
           if (isNewFetch) setStocks([]);
           return;
      }
      
      if (snapshots.length < PAGE_SIZE) {
          setHasMore(false);
      }

      const snapshotsArray = (snapshots || []) as any[];

      // Fetch Market State for these tickers
      const tickers = snapshotsArray.map(s => s.ticker);
      const { data: marketData } = await supabase
        .from('fintra_market_state')
        .select('ticker, ytd_return, market_cap')
        .in('ticker', tickers);

      const marketMap = new Map<string, any>();
      if (marketData) {
        marketData.forEach((m: any) => marketMap.set(m.ticker, m));
      }

      // Merge Market State into Snapshots
      const mergedSnapshots = snapshotsArray.map(s => ({
        ...s,
        market_state: marketMap.get(s.ticker)
      }));

      const filteredByIndustry = mergedSnapshots.filter((row) => {
        const ps = row.profile_structural || {};
        const classification = ps.classification || {};
        
        // 1. Industry Filter
        const industry = row.industry || classification.industry || null;
        const matchIndustry = (!currentIndustry || currentIndustry === "Todas") || industry === currentIndustry;

        // 2. Exchange Filter
        let matchExchange = true;
        if (selectedExchange) {
             const identity = ps.identity || {};
             const exchange = identity.exchange || ps.exchange || null;
             
             if (!exchange) {
                 matchExchange = false; 
             } else {
                 const exStr = String(exchange).toUpperCase();
                 const selStr = selectedExchange.toUpperCase();
                 matchExchange = exStr.includes(selStr);
             }
        }

        return matchIndustry && matchExchange;
      });

      console.log("🔍 [DEBUG] Raw Supabase Snapshots (first 3):", filteredByIndustry.slice(0, 3));

      const enriched: EnrichedStockData[] = filteredByIndustry.map(mapSnapshotToStockData);

      // Deduplicate enriched based on ticker (keep the first one encountered)
      const uniqueEnrichedMap = new Map<string, EnrichedStockData>();
      enriched.forEach(item => {
        if (!uniqueEnrichedMap.has(item.ticker)) {
          uniqueEnrichedMap.set(item.ticker, item);
        }
      });
      const uniqueEnriched = Array.from(uniqueEnrichedMap.values());

      uniqueEnriched.sort(sortStocksBySnapshot);

      setStocks(prev => {
        if (isNewFetch) {
          return uniqueEnriched;
        }
        
        // Evitar duplicados con lo que ya existía
        const existingTickers = new Set(prev.map(p => p.ticker));
        const newUnique = uniqueEnriched.filter(e => !existingTickers.has(e.ticker));
        
        return [...prev, ...newUnique];
      });
    } catch (err) {
      console.error("Error loading sector data:", err);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  // Effect: Filter Change -> Load Data
  useEffect(() => {
    if (!selectedSector) return;
    
    let mounted = true;

    const loadData = async () => {
        setStocks([]); 
        setLoading(true);
        setPage(0);
        setHasMore(true);
        
        if (mounted) {
            fetchData(0, true);
        }
    };
    
    loadData();
    
    return () => { mounted = false; };
  }, [selectedSector, selectedIndustry, selectedExchange]); // Added selectedExchange dependency


  const handleScroll = () => {
      if (scrollContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          if (scrollTop + clientHeight >= scrollHeight - 50 && hasMore && !isFetchingMore && !loading) {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchData(nextPage, false);
          }
      }
  };

  if (!selectedSector) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-tarjetas text-gray-400 text-xs">
             Seleccione un sector...
        </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden shadow-sm">
        {/* Header showing current selection (Optional, can be removed if redundant with Header) */}
        <div className="w-full h-[20px] bg-[#103765] border-b border-zinc-800 px-2 flex items-center justify-between shrink-0">
             <div className="flex items-center gap-2 text-xs">
                 <span className="text-zinc-400">Sector:</span>
                 <span className="text-white font-medium">{selectedSector}</span>
                 {selectedIndustry && selectedIndustry !== "Todas" && (
                     <>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-400">Industry:</span>
                        <span className="text-white font-medium">{selectedIndustry}</span>
                     </>
                 )}
             </div>
        </div>

        {/* Content Area */}
        <div 
          className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent min-h-0 relative"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          {loading && stocks.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="min-w-full inline-block align-top">
              <TablaIFS 
                data={stocks} 
                isLoading={loading}
                isFetchingMore={isFetchingMore}
                onRowClick={onStockSelect} 
                selectedTicker={selectedTicker}
              />
            </div>
          )}
        </div>
    </div>
  );
}
