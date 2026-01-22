"use client";
// Fintra/components/dashboard/SectorAnalysisPanel.tsx
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { getAvailableSectors, getIndustriesForSector } from "@/lib/repository/fintra-db";
import { Loader2 } from "lucide-react";
import TablaIFS, { EnrichedStockData, sortStocksBySnapshot, mapSnapshotToStockData } from "./TablaIFS";

export default function SectorAnalysisPanel({ onStockSelect, selectedTicker }: { onStockSelect?: (symbol: string) => void; selectedTicker?: string }) {
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState("");
  
  // Industry State
  const [industries, setIndustries] = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState("Todas");

  const [stocks, setStocks] = useState<EnrichedStockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(true);
  
  // Pagination State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 1000;

  // Scroll Ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Load sectors
  useEffect(() => {
    let mounted = true;
    
    const fetchMetadata = async () => {
      setLoadingSectors(true);
      try {
        const availableSectors = await getAvailableSectors();
        
        if (mounted) {
          if (availableSectors.length > 0) {
            setSectors(availableSectors);
            const defaultSector = availableSectors.find(s => s === "Technology") || availableSectors[0];
            setSelectedSector(defaultSector);
          } else {
             setSectors([]);
          }
        }
      } catch (err) {
        console.error("Error loading metadata:", err);
      } finally {
        if (mounted) setLoadingSectors(false);
      }
    };
    
    fetchMetadata();
    
    return () => { mounted = false; };
  }, []);

  // 2. Fetch Data Function
  const fetchData = async (pageNum: number, isNewFetch: boolean, industryOverride?: string) => {
    if (!selectedSector) return;
    
    const currentIndustry = industryOverride !== undefined ? industryOverride : selectedIndustry;
    
    if (isNewFetch) {
        setLoading(true);
        setStocks([]);
    } else {
        setIsFetchingMore(true);
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
        if (!currentIndustry || currentIndustry === "Todas") return true;
        const ps = row.profile_structural || {};
        const classification = ps.classification || {};
        const industry = row.industry || classification.industry || null;
        return industry === currentIndustry;
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

  // 3. Effect: Sector Change -> Load Industries -> Load Data
  useEffect(() => {
    if (!selectedSector) return;
    
    let mounted = true;

    const loadIndustriesAndData = async () => {
        // Reset stocks and show loading while switching sectors
        setStocks([]); 
        setLoading(true);
        setPage(0);
        setHasMore(true);
        setSelectedIndustry("Todas");
        
        // Fetch industries
        const inds = await getIndustriesForSector(selectedSector);
        
        if (mounted) {
            setIndustries(inds);
            // Now fetch data for "Todas"
            fetchData(0, true, "Todas");
        }
    };
    
    loadIndustriesAndData();
    
    return () => { mounted = false; };
  }, [selectedSector]);

  // 4. Handle Industry Change
  const handleIndustryChange = (val: string) => {
      if (val === selectedIndustry) return;
      setSelectedIndustry(val);
      setPage(0);
      setHasMore(true);
      fetchData(0, true, val);
  };

  const handleScroll = () => {
      if (scrollContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
          if (scrollTop + clientHeight >= scrollHeight - 50 && hasMore && !isFetchingMore && !loading) {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchData(nextPage, false, selectedIndustry);
          }
      }
  };


  const handleSectorChange = (val: string) => {
    setSelectedSector(val);
  };

  const selectedStockData = stocks.find(s => s.ticker === selectedTicker);

  if (loadingSectors) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-tarjetas text-gray-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando sectores...
        </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden shadow-sm">


		<Tabs value={selectedSector} onValueChange={handleSectorChange} className="w-full flex-1 flex flex-col min-h-0">
        <div className="w-full border-b border-zinc-800 bg-transparent z-10 shrink-0">
          <div className="w-full overflow-x-auto whitespace-nowrap">
            <TabsList className="bg-transparent h-auto p-0 flex min-w-full w-max gap-0.5 border-b-2 border-black ">
              {sectors.map((sector) => (
                <TabsTrigger 
                  key={sector} 
                  value={sector} 
                  className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#002D72] data-[state=active]:text-white text-xs px-2 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors flex-1"
                >
                  {sector}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="py-1 bg-white/[0.02] shrink-0 border border-t-0 border-b-0 border-zinc-800">
          <h4 className="text-xs font-medium text-gray-400 text-center">
            {selectedStockData && selectedStockData.sectorRank != null ? (
               <span className="text-white font-mono">
                 #{selectedStockData.sectorRank} {selectedStockData.sectorRankTotal ? `/ ${selectedStockData.sectorRankTotal}` : ""}
               </span>
            ) : (
               <span>Acciones del sector <span className="text-[#FFA028]">{selectedSector}</span> ({stocks.length})</span>
            )}
          </h4>
        </div>

        {industries.length > 0 && (
			<div className="w-full border-b border-zinc-800 bg-[#0A0A0A] shrink-0">
             <Tabs value={selectedIndustry} onValueChange={handleIndustryChange} className="w-full">
					<div className="w-full overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent ">
                  <TabsList className="bg-transparent h-auto p-0 flex min-w-full w-max gap-0.5">
                      <TabsTrigger 
                        value="Todas" 
                        className="rounded-none border-transparent data-[state=active]:bg-[#002D72] data-[state=active]:text-[#FFFFFF] text-[10px] px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Todas
                      </TabsTrigger>
                      {industries.map(ind => (
                          <TabsTrigger 
                            key={ind} 
                            value={ind} 
                            className="rounded-none border-transparent data-[state=active]:bg-[#002D72] data-[state=active]:text-[#FFFFFF] text-[10px] px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors" 
                          >
                              {ind}
                          </TabsTrigger>
                      ))}
                  </TabsList>
                </div>
             </Tabs>
          </div>
        )}

        <TablaIFS 
            data={stocks}
            isLoading={loading}
            isFetchingMore={isFetchingMore}
            onRowClick={onStockSelect}
            selectedTicker={selectedTicker}
            onScroll={handleScroll}
            scrollRef={scrollContainerRef}
        />
      </Tabs>
    </div>
  );
}
