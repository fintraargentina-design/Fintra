"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getHeatmapColor } from "@/lib/utils";
import { enrichStocksWithData, EnrichedStockData } from "@/lib/services/stock-enrichment";
import { Loader2 } from "lucide-react";

const SECTORS_MAP: Record<string, string[]> = {
  "Technology": ["NVDA", "MSFT", "GOOGL", "AMD", "ORCL", "AAPL"],
  "Healthcare": ["LLY", "JNJ", "PFE", "UNH", "ABBV", "MRK"],
  "Financials": ["JPM", "V", "MA", "BAC", "WFC", "GS"],
  "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC"],
  "Materials": ["LIN", "APD", "FCX", "NEM", "SCCO", "SHW"],
  "Consumer Disc.": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX"],
  "Consumer Staples": ["PG", "COST", "WMT", "KO", "PEP", "PM"],
  "Industrials": ["GE", "CAT", "HON", "UNP", "UPS", "BA"],
  "Utilities": ["NEE", "SO", "DUK", "SRE", "AEP", "D"],
  "Comm. Services": ["META", "GOOG", "NFLX", "DIS", "TMUS", "CMCSA"]
};

const SECTORS = Object.keys(SECTORS_MAP);

export default function SectorAnalysisPanel({ onStockSelect }: { onStockSelect?: (symbol: string) => void }) {
  const [selectedSector, setSelectedSector] = useState("Technology");
  const [stocks, setStocks] = useState<EnrichedStockData[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      const tickers = SECTORS_MAP[selectedSector] || [];
      
      try {
        const enriched = await enrichStocksWithData(tickers);
        if (mounted) {
          // Sort by FGOS by default
          setStocks(enriched.sort((a, b) => b.fgos - a.fgos));
        }
      } catch (err) {
        console.error("Error loading sector data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => { mounted = false; };
  }, [selectedSector]);

  const getFgosColor = (s: number) => 
    s >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20" : 
    s >= 50 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : 
    "bg-red-500/10 text-red-400 border-red-500/20";

  const getValBadge = (v: string) => {
    if (v === "Undervalued" || v === "Infravalorada") return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Infravalorada</Badge>;
    if (v === "Fair" || v === "Justa") return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Justa</Badge>;
    return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-[9px] h-5 w-24 justify-center" variant="outline">Sobrevalorada</Badge>;
  };

  const formatMarketCap = (val: number) => {
    if (val >= 1e12) return `${(val / 1e12).toFixed(1)}T`;
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    return val.toFixed(0);
  };

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden shadow-sm">
      <Tabs defaultValue="Technology" onValueChange={setSelectedSector} className="w-full h-full flex flex-col">
        <div className="w-full border-b border-zinc-800 bg-transparent z-10 shrink-0">
          <div className="w-full overflow-x-auto scrollbar-thin whitespace-nowrap">
            <TabsList className="bg-transparent h-auto p-0 flex min-w-full w-max gap-0.5 border-b-2 border-black ">
              {SECTORS.map((sector) => (
                <TabsTrigger 
                  key={sector} 
                  value={sector} 
                  className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#0056FF] data-[state=active]:text-white text-xs px-2 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors flex-1"
                >
                  {sector}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="py-1 border border-zinc-800 bg-white/[0.02] shrink-0">
          <h4 className="text-xs font-medium text-gray-400 text-center">
            Acciones del sector <span className="text-[#FFA028]">{selectedSector}</span>
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin relative p-0 border border-zinc-800">
          <table className="w-full text-sm">
            <TableHeader className="sticky top-0 z-10 bg-[#1D1D1D]">
              <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
                <TableHead className="text-gray-300 text-[10px] h-6 w-[60px]">Ticker</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-center w-[50px]">Ranking Sectorial</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-center w-[80px]">Valuación</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-center w-[50px]">Ecosistema</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-center w-[60px]">Div. Yield</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-center w-[60px]">Estimación</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-right w-[70px]">Last Price</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-right w-[60px]">YTD %</TableHead>
                <TableHead className="text-gray-300 text-[10px] h-6 text-right w-[70px]">Mkt Cap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                       <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos en vivo...
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
                  <TableCell 
                    className="text-center px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ backgroundColor: getHeatmapColor(stock.fgos - 50) }}
                  >
                    {stock.fgos || '-'}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    {getValBadge(stock.valuation)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-blue-400 font-bold">
                    {stock.ecosystem || '-'}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {stock.divYield ? `${stock.divYield.toFixed(2)}%` : '-'}
                  </TableCell>
                  <TableCell 
                    className={`text-center px-2 py-0.5 text-[10px] font-medium ${stock.estimation > 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {stock.estimation ? `${stock.estimation > 0 ? '+' : ''}${stock.estimation.toFixed(1)}%` : '-'}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white">
                    ${stock.price.toFixed(2)}
                  </TableCell>
                  <TableCell 
                    className="text-right px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: getHeatmapColor(stock.ytd) }}
                  >
                    {stock.ytd >= 0 ? "+" : ""}{stock.ytd.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-400">
                    {formatMarketCap(stock.marketCap)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      </Tabs>
    </div>
  );
}
