"use client";
// Fintra/components/dashboard/SectorAnalysisPanel.tsx
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getHeatmapColor, formatMarketCap } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getAvailableSectors, getIndustriesForSector } from "@/lib/repository/fintra-db";
import { Loader2 } from "lucide-react";
import { FgosScoreCell } from "@/components/ui/FgosScoreCell";

// Local interface definition to avoid importing from services that might depend on API clients
interface EnrichedStockData {
  ticker: string;
  name: string;
  price: number | null;
  marketCap: number | null;
  ytd: number | null;
  divYield: number | null;
  estimation: number | null;
  targetPrice: number | null;
  fgos: number;
  confidenceLabel?: string;
  valuation: string;
  ecosystem: number;
}

export default function SectorAnalysisPanel({ onStockSelect }: { onStockSelect?: (symbol: string) => void }) {
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

      // Query fintra_market_state
      let query = supabase
        .from('fintra_market_state')
        .select('ticker, price, market_cap, ytd_return, fgos_score, valuation_status, ecosystem_score, fgos_confidence_label')
        .eq('sector', selectedSector);

      if (currentIndustry && currentIndustry !== "Todas") {
          query = query.eq('industry', currentIndustry);
      }

      const { data: snapshots, error } = await query
        .order('fgos_score', { ascending: false, nullsFirst: false })
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

      // Map to EnrichedStockData
      const enriched: EnrichedStockData[] = snapshots.map((row: any) => ({
          ticker: row.ticker,
          name: row.ticker, // row.company_name not available yet
          price: row.price,
          marketCap: row.market_cap,
          ytd: row.ytd_return,
          divYield: null, // Not in market_state yet
          estimation: null, // Not in market_state yet
          targetPrice: null,
          fgos: row.fgos_score ?? 0,
          confidenceLabel: row.fgos_confidence_label,
          valuation: row.valuation_status || "N/A",
          ecosystem: row.ecosystem_score ?? 50
      }));

      setStocks(prev => {
        if (isNewFetch) {
          return enriched;
        }
        
        // Evitar duplicados
        const existingTickers = new Set(prev.map(p => p.ticker));
        const newUnique = enriched.filter(e => !existingTickers.has(e.ticker));
        
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

  const getFgosColor = (s: number) => 
    s >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20" : 
    s >= 50 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
    "bg-red-500/10 text-red-400 border-red-500/20";

  const getValBadge = (v: string) => {
    if (!v) return <span className="text-gray-500 text-[10px]">-</span>;
    const lowerV = v.toLowerCase();
    if (lowerV.includes("under") || lowerV.includes("infra")) return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Infravalorada</Badge>;
    if (lowerV.includes("fair") || lowerV.includes("justa")) return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Justa</Badge>;
    if (lowerV === "n/a") return <span className="text-gray-500 text-[10px]">-</span>;
    return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Sobrevalorada</Badge>;
  };

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
            <span>Acciones del sector <span className="text-[#FFA028]">{selectedSector}</span> ({stocks.length})</span>
          </h4>
        </div>

        {industries.length > 0 && (
			<div className="w-full border-b border-zinc-800 bg-zinc-900/50 shrink-0">
             <Tabs value={selectedIndustry} onValueChange={handleIndustryChange} className="w-full">
					<div className="w-full overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent scrollbar-on-hover">
                  <TabsList className="bg-transparent h-auto p-0 flex min-w-full w-max gap-0">
                      <TabsTrigger 
                        value="Todas" 
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FFA028] data-[state=active]:text-[#FFA028] text-[10px] px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        Todas
                      </TabsTrigger>
                      {industries.map(ind => (
                          <TabsTrigger 
                            key={ind} 
                            value={ind} 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FFA028] data-[state=active]:text-[#FFA028] text-[10px] px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                          >
                              {ind}
                          </TabsTrigger>
                      ))}
                  </TabsList>
                </div>
             </Tabs>
          </div>
        )}

			<div
			  ref={scrollContainerRef}
			  className="flex-1 relative p-0 border border-t-0 border-zinc-800 overflow-y-auto scrollbar-on-hover"
			  onScroll={handleScroll}
			>
          <table className="w-full text-sm">
            <TableHeader className="sticky top-0 z-10 bg-[#1D1D1D]">
              <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[60px]">Ticker</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Rank. Sectorial IFS</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Val. Relativa al Sector</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[50px]">Ecosistema</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[60px]">Div. Yield</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[60px]">Estimación</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Precio EOD</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[60px]">YTD %</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Mkt Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                       <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos...
                    </div>
                  </TableCell>
                </TableRow>
              ) : stocks.map((stock) => (
                <TableRow 
                  key={stock.ticker} 
                  className="border-zinc-800 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => onStockSelect?.(stock.ticker)}
                >
                  <TableCell className="font-bold text-white px-2 py-0.5 text-xs">{stock.ticker}</TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    <FgosScoreCell score={stock.fgos} confidenceLabel={stock.confidenceLabel} />
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    {getValBadge(stock.valuation)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-blue-400 font-bold">
                    {stock.ecosystem || '-'}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {stock.divYield != null ? `${stock.divYield.toFixed(2)}%` : '-'}
                  </TableCell>
                  <TableCell 
                    className="text-center px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: stock.estimation ? getHeatmapColor(stock.estimation) : 'transparent' }}
                  >
                    {stock.estimation != null ? `${stock.estimation > 0 ? '+' : ''}${stock.estimation.toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white">
                    {stock.price != null ? `$${Number(stock.price).toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell 
                    className="text-center px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: stock.ytd ? getHeatmapColor(stock.ytd) : 'transparent' }}
                  >
                    {stock.ytd != null ? `${stock.ytd >= 0 ? "+" : ""}${Number(stock.ytd).toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-400">
                    {stock.marketCap != null ? formatMarketCap(Number(stock.marketCap)) : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {isFetchingMore && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={9} className="h-12 text-center text-gray-400 text-xs">
                     <div className="flex justify-center items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Cargando más...
                     </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && !isFetchingMore && stocks.length === 0 && (
                 <TableRow className="border-zinc-800">
                  <TableCell colSpan={9} className="h-24 text-center text-gray-500 text-xs">
                    No se encontraron resultados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      </Tabs>
    </div>
  );
}
