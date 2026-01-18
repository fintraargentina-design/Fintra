"use client";
// Fintra/components/dashboard/SectorAnalysisPanel.tsx
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMarketCap } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getAvailableSectors, getIndustriesForSector } from "@/lib/repository/fintra-db";
import { Loader2 } from "lucide-react";

// Local interface definition: snapshot-driven view model
interface EnrichedStockData {
  ticker: string;
  sectorRank: number | null;
  sectorRankTotal: number | null;
  sectorValuationStatus: string | null;
  fgosBand: string | null;
  competitiveStructureBand: string | null;
  relativeResultBand: string | null;
  strategyState: string | null;
  priceEod: number | null;
  ytdReturn: number | null;
  marketCap: number | null;
}

const FGOS_BAND_ORDER: Record<string, number> = {
  strong: 1,
  defendable: 2,
  weak: 3,
};

const RELATIVE_RESULT_ORDER: Record<string, number> = {
  outperformer: 1,
  neutral: 2,
  underperformer: 3,
};

const VALUATION_ORDER: Record<string, number> = {
  undervalued: 1,
  fairly_valued: 2,
  overvalued: 3,
};

const getRankValue = (val: number | null | undefined) =>
  val == null ? Number.MAX_SAFE_INTEGER : val;

const getOrderValue = (val: string | null | undefined, map: Record<string, number>) => {
  if (!val) return Number.MAX_SAFE_INTEGER;
  const key = String(val).toLowerCase();
  return map[key] ?? Number.MAX_SAFE_INTEGER - 1;
};

const sortStocksBySnapshot = (a: EnrichedStockData, b: EnrichedStockData) => {
  const srA = getRankValue(a.sectorRank);
  const srB = getRankValue(b.sectorRank);
  if (srA !== srB) return srA - srB;

  const fbA = getOrderValue(a.fgosBand, FGOS_BAND_ORDER);
  const fbB = getOrderValue(b.fgosBand, FGOS_BAND_ORDER);
  if (fbA !== fbB) return fbA - fbB;

  const csA = getOrderValue(a.competitiveStructureBand, FGOS_BAND_ORDER);
  const csB = getOrderValue(b.competitiveStructureBand, FGOS_BAND_ORDER);
  if (csA !== csB) return csA - csB;

  const rrA = getOrderValue(a.relativeResultBand, RELATIVE_RESULT_ORDER);
  const rrB = getOrderValue(b.relativeResultBand, RELATIVE_RESULT_ORDER);
  if (rrA !== rrB) return rrA - rrB;

  const valA = getOrderValue(a.sectorValuationStatus, VALUATION_ORDER);
  const valB = getOrderValue(b.sectorValuationStatus, VALUATION_ORDER);
  if (valA !== valB) return valA - valB;

  return a.ticker.localeCompare(b.ticker);
};

const formatFgosBand = (band: string | null) => {
  if (!band) return "—";
  const lower = band.toLowerCase();
  if (lower === "strong") return "Fuerte";
  if (lower === "defendable") return "Defendible";
  if (lower === "weak") return "Débil";
  return band;
};

const formatRelativeResult = (band: string | null) => {
  if (!band) return "—";
  const lower = band.toLowerCase();
  if (lower === "outperformer") return "Supera al benchmark";
  if (lower === "neutral") return "En línea con el benchmark";
  if (lower === "underperformer") return "Por debajo del benchmark";
  return band;
};

const formatStrategyState = (state: string | null) => {
  if (!state) return "—";
  return state.charAt(0).toUpperCase() + state.slice(1);
};

const ValuationStatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <span className="text-gray-500 text-[10px]">—</span>;

  const lower = status.toLowerCase();
  let label = status;
  if (lower === "undervalued" || lower === "cheap_sector") label = "Barata vs sector";
  else if (lower === "fairly_valued" || lower === "fair_sector") label = "En línea vs sector";
  else if (lower === "overvalued" || lower === "expensive_sector") label = "Cara vs sector";

  return (
    <Badge
      className="px-2 py-0.5 text-[9px] h-5 justify-center whitespace-nowrap bg-zinc-900/60 border-zinc-600 text-zinc-200"
      variant="outline"
    >
      {label}
    </Badge>
  );
};

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

      const filteredByIndustry = snapshotsArray.filter((row) => {
        if (!currentIndustry || currentIndustry === "Todas") return true;
        const ps = row.profile_structural || {};
        const classification = ps.classification || {};
        const industry = row.industry || classification.industry || null;
        return industry === currentIndustry;
      });

      const enriched: EnrichedStockData[] = filteredByIndustry.map((row: any) => {
        const marketSnapshot = row.market_snapshot || {};
        const valuation = row.valuation || {};
        const profileStructural = row.profile_structural || {};
        const financialScores = profileStructural.financial_scores || {};
        const fgosComponents = row.fgos_components || {};
        const competitiveAdvantage = fgosComponents.competitive_advantage || {};
        const marketPosition = row.market_position || {};

        return {
          ticker: row.ticker,
          sectorRank: marketPosition.sector_rank ?? null,
          sectorRankTotal: marketPosition.sector_total_count ?? null,
          sectorValuationStatus: valuation.valuation_status ?? null,
          fgosBand: row.fgos_category ?? null,
          competitiveStructureBand: competitiveAdvantage.band ?? null,
          relativeResultBand: row.relative_return?.band ?? null,
          strategyState: row.investment_verdict?.verdict_label ?? null,
          priceEod: marketSnapshot.price ?? marketSnapshot.price_eod ?? null,
          ytdReturn: marketSnapshot.ytd_percent ?? null,
          marketCap: marketSnapshot.market_cap ?? financialScores.marketCap ?? null,
        } as EnrichedStockData;
      });

      enriched.sort(sortStocksBySnapshot);

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

			<div
			  ref={scrollContainerRef}
			  className="flex-1 relative p-0 border border-t-0 border-zinc-800 overflow-y-auto"
			  onScroll={handleScroll}
			>
          <table className="w-full text-sm">
            <TableHeader className="sticky top-0 z-10 bg-[#1D1D1D]">
              <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[60px]">Ticker</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Ranking Sectorial (IFS)</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Valuación Relativa al Sector</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Calidad Fundamental</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Estructura Competitiva</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Resultado Relativo</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Estado Estratégico</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Precio EOD</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[60px]">YTD %</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Mkt Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={10} className="h-24 text-center">
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
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-200 font-mono">
                    {stock.sectorRank != null
                      ? stock.sectorRankTotal != null
                        ? `#${stock.sectorRank} / ${stock.sectorRankTotal}`
                        : `#${stock.sectorRank}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    <ValuationStatusBadge status={stock.sectorValuationStatus} />
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatFgosBand(stock.fgosBand)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatFgosBand(stock.competitiveStructureBand)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatRelativeResult(stock.relativeResultBand)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatStrategyState(stock.strategyState)}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white">
                    {stock.priceEod != null ? `$${Number(stock.priceEod).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell 
                    className="text-center px-2 py-0.5 text-[10px] font-medium text-gray-300"
                  >
                    {stock.ytdReturn != null ? `${stock.ytdReturn >= 0 ? "+" : ""}${Number(stock.ytdReturn).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-400">
                    {stock.marketCap != null ? formatMarketCap(Number(stock.marketCap)) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {isFetchingMore && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={10} className="h-12 text-center text-gray-400 text-xs">
                     <div className="flex justify-center items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Cargando más...
                     </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && !isFetchingMore && stocks.length === 0 && (
                 <TableRow className="border-zinc-800">
                  <TableCell colSpan={10} className="h-24 text-center text-gray-500 text-xs">
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
