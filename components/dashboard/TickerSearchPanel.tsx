"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Search, FilterX } from "lucide-react";
import { registerPendingStock } from "@/lib/services/search-service";
import { useRouter } from "next/navigation";
import { formatMarketCap } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface ScreenerResult {
  symbol: string;
  companyName: string;
  marketCap: number;
  sector: string;
  industry: string;
  beta: number;
  price: number;
  lastAnnualDividend: number;
  volume: number;
  exchange: string;
  exchangeShortName: string;
  country: string;
  isEtf: boolean;
  isActivelyTrading: boolean;
}

const SECTORS = [
  "Technology", "Financial Services", "Healthcare", "Consumer Cyclical", 
  "Industrials", "Energy", "Utilities", "Real Estate", 
  "Basic Materials", "Communication Services", "Consumer Defensive"
];

const COUNTRIES = ["US", "CN", "GB", "DE", "FR", "JP", "CA", "IN"];
const EXCHANGES = ["NYSE", "NASDAQ", "AMEX", "EURONEXT", "TSX", "LSE"];

export default function TickerSearchPanel({ onStockSelect }: { onStockSelect?: (ticker: string) => void }) {
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Filters state
  const [filters, setFilters] = useState({
    marketCapMoreThan: "",
    priceMoreThan: "",
    priceLowerThan: "",
    volumeMoreThan: "",
    betaMoreThan: "",
    betaLowerThan: "",
    sector: "ALL",
    industry: "ALL",
    country: "ALL",
    exchange: "ALL",
    limit: "100",
    isEtf: false,
    isActivelyTrading: true
  });

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', filters.limit);
      
      // Add non-empty filters
      if (filters.marketCapMoreThan) params.append('marketCapMoreThan', filters.marketCapMoreThan);
      if (filters.priceMoreThan) params.append('priceMoreThan', filters.priceMoreThan);
      if (filters.priceLowerThan) params.append('priceLowerThan', filters.priceLowerThan);
      if (filters.volumeMoreThan) params.append('volumeMoreThan', filters.volumeMoreThan);
      if (filters.betaMoreThan) params.append('betaMoreThan', filters.betaMoreThan);
      if (filters.betaLowerThan) params.append('betaLowerThan', filters.betaLowerThan);
      if (filters.sector && filters.sector !== 'ALL') params.append('sector', filters.sector);
      if (filters.industry && filters.industry !== 'ALL') params.append('industry', filters.industry);
      if (filters.country && filters.country !== 'ALL') params.append('country', filters.country);
      if (filters.exchange && filters.exchange !== 'ALL') params.append('exchange', filters.exchange);
      
      if (filters.isEtf) params.append('isEtf', 'true');
      if (filters.isActivelyTrading) params.append('isActivelyTrading', 'true');

      // Use the proxy endpoint
      const res = await fetch(`/api/fmp/screener?${params.toString()}`);
      if (!res.ok) throw new Error("Screener failed");
      
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
      setFilters({
        marketCapMoreThan: "",
        priceMoreThan: "",
        priceLowerThan: "",
        volumeMoreThan: "",
        betaMoreThan: "",
        betaLowerThan: "",
        sector: "ALL",
        industry: "ALL",
        country: "ALL",
        exchange: "ALL",
        limit: "100",
        isEtf: false,
        isActivelyTrading: true
      });
      setResults([]);
      setHasSearched(false);
  };

  const handleSelect = async (stock: ScreenerResult) => {
    // Check/Insert into universe
    try {
      const isNew = await registerPendingStock({
        ticker: stock.symbol,
        name: stock.companyName,
        exchange: stock.exchangeShortName || stock.exchange,
        currency: 'USD',
        source: 'fmp',
      });

      if (isNew) {
         toast({
            title: "Ingestion scheduled",
            description: `Scheduled data ingestion for ${stock.symbol}. Data will be available shortly.`,
            variant: "default",
         });
      }
    } catch (e) {
      console.error("Failed to register stock", e);
    }
    
    if (onStockSelect) onStockSelect(stock.symbol);
    else router.push(`/company/${stock.symbol}`);
  };

  return (
     <div className="flex flex-col h-full bg-tarjetas overflow-hidden">
        {/* Filters Toolbar - Compact Grid */}
        <div className="p-3 border-b border-zinc-800 bg-[#121212] shrink-0">
           <div className="grid grid-cols-4 xl:grid-cols-6 gap-2 mb-2">
              <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-gray-500 font-bold">Sector</Label>
                  <Select value={filters.sector} onValueChange={v => setFilters({...filters, sector: v})}>
                     <SelectTrigger className="h-6 text-[10px] bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="ALL">All</SelectItem>
                        {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                     </SelectContent>
                  </Select>
              </div>
              <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-gray-500 font-bold">Exchange</Label>
                  <Select value={filters.exchange} onValueChange={v => setFilters({...filters, exchange: v})}>
                     <SelectTrigger className="h-6 text-[10px] bg-zinc-900 border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="ALL">All</SelectItem>
                        {EXCHANGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                     </SelectContent>
                  </Select>
              </div>
              <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-gray-500 font-bold">Country</Label>
                  <Select value={filters.country} onValueChange={v => setFilters({...filters, country: v})}>
                     <SelectTrigger className="h-6 text-[10px] bg-zinc-900 border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="ALL">All</SelectItem>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                     </SelectContent>
                  </Select>
              </div>
              <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-gray-500 font-bold">Min Mkt Cap</Label>
                  <Input 
                    placeholder="e.g. 1000000000" 
                    className="h-6 text-[10px] bg-zinc-900 border-zinc-800 placeholder:text-gray-700"
                    value={filters.marketCapMoreThan}
                    onChange={e => setFilters({...filters, marketCapMoreThan: e.target.value})}
                  />
              </div>
               <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-gray-500 font-bold">Min Price</Label>
                  <Input 
                    placeholder="e.g. 10" 
                    className="h-6 text-[10px] bg-zinc-900 border-zinc-800 placeholder:text-gray-700"
                    value={filters.priceMoreThan}
                    onChange={e => setFilters({...filters, priceMoreThan: e.target.value})}
                  />
              </div>
              <div className="space-y-1">
                  <Label className="text-[9px] uppercase text-gray-500 font-bold">Limit</Label>
                  <Select value={filters.limit} onValueChange={v => setFilters({...filters, limit: v})}>
                     <SelectTrigger className="h-6 text-[10px] bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                     <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                     </SelectContent>
                  </Select>
              </div>
              
              <div className="flex items-end gap-2 col-span-2 xl:col-span-1">
                 <div className="flex items-center gap-2 mb-1">
                    <Checkbox id="isEtf" checked={filters.isEtf} onCheckedChange={(c) => setFilters({...filters, isEtf: c as boolean})} className="border-zinc-700 data-[state=checked]:bg-blue-600" />
                    <Label htmlFor="isEtf" className="text-[10px] text-gray-400">ETF</Label>
                 </div>
                 <div className="flex items-center gap-2 mb-1">
                    <Checkbox id="active" checked={filters.isActivelyTrading} onCheckedChange={(c) => setFilters({...filters, isActivelyTrading: c as boolean})} className="border-zinc-700 data-[state=checked]:bg-blue-600" />
                    <Label htmlFor="active" className="text-[10px] text-gray-400">Active</Label>
                 </div>
              </div>
           </div>
           
           <div className="flex justify-end gap-2 mt-2">
               <Button onClick={handleReset} variant="outline" size="sm" className="h-6 text-[10px] border-zinc-700 text-gray-400 hover:text-white hover:bg-zinc-800 rounded-none">
                  <FilterX className="w-3 h-3 mr-1" /> Reset
               </Button>
               <Button onClick={handleSearch} size="sm" className="h-6 text-[10px] bg-[#0056FF] hover:bg-blue-600 text-white rounded-none">
                  {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Search className="w-3 h-3 mr-1" />} 
                  Buscar
               </Button>
           </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 overflow-auto scrollbar-thin relative">
           <Table>
              <TableHeader className="sticky top-0 bg-[#1D1D1D] z-10 shadow-sm">
                 <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] border-b-0">
                    <TableHead className="h-7 text-[10px] text-gray-400 font-bold w-[80px]">Ticker</TableHead>
                    <TableHead className="h-7 text-[10px] text-gray-400 font-bold">Name</TableHead>
                    <TableHead className="h-7 text-[10px] text-gray-400 font-bold text-right w-[80px]">Price</TableHead>
                    <TableHead className="h-7 text-[10px] text-gray-400 font-bold text-right w-[100px]">Mkt Cap</TableHead>
                    <TableHead className="h-7 text-[10px] text-gray-400 font-bold text-center w-[120px]">Sector</TableHead>
                    <TableHead className="h-7 text-[10px] text-gray-400 font-bold text-center w-[60px]">Beta</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {loading ? (
                    <TableRow>
                       <TableCell colSpan={6} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                             <Loader2 className="w-6 h-6 animate-spin text-[#0056FF]" />
                             <span className="text-xs text-gray-500">Buscando acciones...</span>
                          </div>
                       </TableCell>
                    </TableRow>
                 ) : results.length === 0 ? (
                    <TableRow>
                       <TableCell colSpan={6} className="text-center py-12 text-gray-500 text-xs">
                          {hasSearched ? "No se encontraron resultados." : "Utiliza los filtros para buscar acciones."}
                       </TableCell>
                    </TableRow>
                 ) : (
                    results.map(stock => (
                        <TableRow 
                           key={stock.symbol} 
                           className="border-zinc-800 hover:bg-white/5 cursor-pointer transition-colors group" 
                           onClick={() => handleSelect(stock)}
                        >
                           <TableCell className="py-1.5 text-[11px] font-bold text-white font-mono group-hover:text-[#FFA028] transition-colors">
                              {stock.symbol}
                           </TableCell>
                           <TableCell className="py-1.5 text-[11px] text-gray-400 max-w-[150px] truncate" title={stock.companyName}>
                              {stock.companyName}
                           </TableCell>
                           <TableCell className="py-1.5 text-[11px] text-right text-gray-300 font-mono">
                              ${stock.price.toFixed(2)}
                           </TableCell>
                           <TableCell className="py-1.5 text-[11px] text-right text-gray-500 font-mono">
                              {formatMarketCap(stock.marketCap)}
                           </TableCell>
                           <TableCell className="py-1.5 text-[10px] text-center text-gray-500 truncate max-w-[100px]">
                              {stock.sector}
                           </TableCell>
                           <TableCell className="py-1.5 text-[10px] text-center text-gray-500 font-mono">
                              {stock.beta ? stock.beta.toFixed(2) : '-'}
                           </TableCell>
                        </TableRow>
                    ))
                 )}
              </TableBody>
           </Table>
        </div>
     </div>
  );
}
