"use client";

import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { Badge } from "@/components/ui/badge";
import { EnrichedStockData } from "@/lib/services/stock-enrichment";
import { getAvailableSectors } from "@/lib/repository/fintra-db";
import { Loader2, Filter, Search, X } from "lucide-react";
import { apiScreener, apiIndustries, apiSearch, apiProfile } from "@/lib/fmp/sdk";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMarketCap } from "@/lib/utils";
import { FMPSearchResult } from "@/lib/fmp/types";

export default function TickerSearchPanel({ onStockSelect }: { onStockSelect?: (symbol: string) => void }) {
  const [sectors, setSectors] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [stocks, setStocks] = useState<EnrichedStockData[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Local filter
  const [tickerSearch, setTickerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FMPSearchResult[]>([]);
  const [enrichedSearchResults, setEnrichedSearchResults] = useState<EnrichedStockData[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Screener State
  const [isScreenerOpen, setIsScreenerOpen] = useState(true); // Default open for this tab
  const [screenerParams, setScreenerParams] = useState({
    marketCapMoreThan: "",
    marketCapLowerThan: "",
    priceMoreThan: "",
    priceLowerThan: "",
    betaMoreThan: "",
    betaLowerThan: "",
    volumeMoreThan: "",
    volumeLowerThan: "",
    dividendMoreThan: "",
    dividendLowerThan: "",
    sector: "",
    industry: "",
    country: "US",
    exchange: "",
    limit: "100",
    isEtf: false,
    isFund: false,
    isActivelyTrading: true,
    includeAllShareClasses: false
  });

  // Load metadata
  useEffect(() => {
    let mounted = true;
    const fetchMetadata = async () => {
      try {
        const [availableSectors, availableIndustries] = await Promise.all([
          getAvailableSectors(),
          apiIndustries().catch(() => [])
        ]);
        
        if (mounted) {
          if (availableSectors.length > 0) setSectors(availableSectors);
          if (availableIndustries.length > 0) setIndustries(availableIndustries.sort());
        }
      } catch (err) {
        console.error("Error loading metadata:", err);
      }
    };
    fetchMetadata();
    return () => { mounted = false; };
  }, []);

  // Search Effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (tickerSearch.length >= 1) {
        setLoading(true);
        try {
          // Si el usuario ya seleccionó (es decir, el texto coincide exactamente con una opción),
          // podríamos evitar buscar de nuevo, pero FMP es rápido.
          const results = await apiSearch(tickerSearch, 20); // Aumentamos limite para llenar tabla
          setSearchResults(results);
          
          if (results.length > 0) {
             const symbols = results.slice(0, 15).map(r => r.symbol).join(',');
             let profiles: any[] = [];
             try {
                profiles = await apiProfile(symbols);
             } catch (e) {
                console.warn("Failed to fetch profiles for search", e);
             }
             
             const enriched: EnrichedStockData[] = results.map(r => {
                const p = profiles.find((prof: any) => prof.symbol === r.symbol);
                return {
                    ticker: r.symbol,
                    name: r.name,
                    price: p?.price || 0,
                    marketCap: p?.mktCap || null,
                    ytd: null,
                    divYield: p?.lastDiv && p?.price ? (p.lastDiv / p.price) * 100 : 0,
                    estimation: 0,
                    targetPrice: 0,
                    fgos: 0,
                    valuation: "N/A",
                    ecosystem: 50
                };
             });
             setEnrichedSearchResults(enriched);
          } else {
             setEnrichedSearchResults([]);
          }

          setShowResults(true);
        } catch (err) {
          console.error("Search error:", err);
        } finally {
            setLoading(false);
        }
      } else {
        setSearchResults([]);
        setEnrichedSearchResults([]);
        setShowResults(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [tickerSearch]);

  const runScreener = async () => {
    setLoading(true);
    try {
      // Si hay texto de búsqueda, limpiarlo para mostrar resultados del screener
      if (tickerSearch) setTickerSearch(""); 
      
      const finalParams: Record<string, any> = {};
      if (screenerParams.marketCapMoreThan) finalParams.marketCapMoreThan = screenerParams.marketCapMoreThan;
      if (screenerParams.marketCapLowerThan) finalParams.marketCapLowerThan = screenerParams.marketCapLowerThan;
      if (screenerParams.priceMoreThan) finalParams.priceMoreThan = screenerParams.priceMoreThan;
      if (screenerParams.priceLowerThan) finalParams.priceLowerThan = screenerParams.priceLowerThan;
      if (screenerParams.betaMoreThan) finalParams.betaMoreThan = screenerParams.betaMoreThan;
      if (screenerParams.betaLowerThan) finalParams.betaLowerThan = screenerParams.betaLowerThan;
      if (screenerParams.volumeMoreThan) finalParams.volumeMoreThan = screenerParams.volumeMoreThan;
      if (screenerParams.volumeLowerThan) finalParams.volumeLowerThan = screenerParams.volumeLowerThan;
      if (screenerParams.dividendMoreThan) finalParams.dividendMoreThan = screenerParams.dividendMoreThan;
      if (screenerParams.dividendLowerThan) finalParams.dividendLowerThan = screenerParams.dividendLowerThan;
      
      if (screenerParams.sector && screenerParams.sector !== "ALL") finalParams.sector = screenerParams.sector;
      if (screenerParams.industry && screenerParams.industry !== "ALL") finalParams.industry = screenerParams.industry;
      if (screenerParams.country) finalParams.country = screenerParams.country;
      if (screenerParams.exchange) finalParams.exchange = screenerParams.exchange;
      if (screenerParams.limit) finalParams.limit = screenerParams.limit;
      
      if (screenerParams.isEtf) finalParams.isEtf = "true";
      if (screenerParams.isFund) finalParams.isFund = "true";
      if (screenerParams.isActivelyTrading) finalParams.isActivelyTrading = "true";
      else finalParams.isActivelyTrading = "false";
      
      if (screenerParams.includeAllShareClasses) finalParams.includeAllShareClasses = "true";

      const results = await apiScreener(finalParams);
      
      const mapped: EnrichedStockData[] = results.map(r => ({
        ticker: r.symbol,
        name: r.companyName,
        price: r.price,
        marketCap: r.marketCap,
        ytd: null,
        divYield: r.lastAnnualDividend && r.price ? (r.lastAnnualDividend / r.price) * 100 : 0,
        estimation: 0,
        targetPrice: 0,
        fgos: 0,
        valuation: "N/A",
        ecosystem: 50
      }));

      setStocks(mapped);
    } catch (err) {
      console.error("Screener error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStocks: EnrichedStockData[] = tickerSearch.length > 0 
    ? enrichedSearchResults
    : stocks;

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden shadow-sm">
      <div className="p-2 border-b border-zinc-800 bg-white/[0.02] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
             <div className="flex items-center gap-2 flex-1">
                <Collapsible open={isScreenerOpen} onOpenChange={setIsScreenerOpen}>
                    <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" 
                            className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded-sm transition-colors whitespace-nowrap h-7 border-0 ${
                                isScreenerOpen 
                                ? "bg-[#0056FF] text-white font-medium hover:bg-[#0046CC] hover:text-white" 
                                : "bg-zinc-900 text-gray-400 hover:bg-zinc-800 hover:text-gray-200"
                            }`}
                        >
                            <Filter className="w-3.5 h-3.5 mr-2" />
                            {isScreenerOpen ? "Ocultar Filtros" : "Mostrar Filtros"}
                        </Button>
                    </CollapsibleTrigger>
                </Collapsible>
                
                <div className="relative w-full md:w-64">
                    <Search className="w-3 h-3 absolute left-2 top-2 text-gray-500" />
                    <Input 
                        name="ticker-search"
                        autoComplete="off"
                        maxLength={10}
                        placeholder="BUSCAR TICKER..." 
                        value={tickerSearch}
                        onChange={(e) => {
                            // Sanitize: uppercase and allow only valid ticker characters (A-Z, 0-9, ., -)
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9.-]/g, "");
                            setTickerSearch(val);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && tickerSearch) {
                                e.preventDefault();
                                const exactMatch = enrichedSearchResults.find(r => r.ticker === tickerSearch);
                                if (exactMatch) {
                                    onStockSelect?.(exactMatch.ticker);
                                } else if (enrichedSearchResults.length > 0) {
                                    onStockSelect?.(enrichedSearchResults[0].ticker);
                                } else {
                                    onStockSelect?.(tickerSearch);
                                }
                            }
                        }}
                        className="h-7 text-[10px] uppercase tracking-wider bg-zinc-900 border-zinc-800 pl-7 w-full rounded-sm placeholder:text-gray-600 text-gray-300 focus-visible:ring-0 focus-visible:border-zinc-700"
                    />
                </div>
             </div>
             
             <Button variant="ghost" size="sm" onClick={() => {
                 setStocks([]);
                 setTickerSearch("");
                 setSearchResults([]);
             }} className="h-7 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400 hover:text-white hover:bg-zinc-800 rounded-sm shrink-0">
                <X className="w-3 h-3 mr-1" /> Limpiar
             </Button>
        </div>

        <Collapsible open={isScreenerOpen} onOpenChange={setIsScreenerOpen} className="w-full">
            <CollapsibleContent className="space-y-3 p-3 bg-zinc-900/10 border-t border-zinc-800 mt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Min Market Cap</Label>
                        <Input 
                            type="number" 
                            placeholder="e.g. 1000000" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.marketCapMoreThan}
                            onChange={e => setScreenerParams(p => ({...p, marketCapMoreThan: e.target.value}))}
                        />
                    </div>
                     <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Max Market Cap</Label>
                        <Input 
                            type="number" 
                            placeholder="Max Cap" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.marketCapLowerThan}
                            onChange={e => setScreenerParams(p => ({...p, marketCapLowerThan: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Min Price</Label>
                        <Input 
                            type="number" 
                            placeholder="e.g. 10" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.priceMoreThan}
                            onChange={e => setScreenerParams(p => ({...p, priceMoreThan: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Max Price</Label>
                        <Input 
                            type="number" 
                            placeholder="e.g. 200" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.priceLowerThan}
                            onChange={e => setScreenerParams(p => ({...p, priceLowerThan: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Min Beta</Label>
                        <Input 
                            type="number" 
                            placeholder="e.g. 1" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.betaMoreThan}
                            onChange={e => setScreenerParams(p => ({...p, betaMoreThan: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Max Beta</Label>
                        <Input 
                            type="number" 
                            placeholder="Max Beta" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.betaLowerThan}
                            onChange={e => setScreenerParams(p => ({...p, betaLowerThan: e.target.value}))}
                        />
                    </div>
                     <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Min Volume</Label>
                        <Input 
                            type="number" 
                            placeholder="Min Vol" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.volumeMoreThan}
                            onChange={e => setScreenerParams(p => ({...p, volumeMoreThan: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Max Volume</Label>
                        <Input 
                            type="number" 
                            placeholder="Max Vol" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.volumeLowerThan}
                            onChange={e => setScreenerParams(p => ({...p, volumeLowerThan: e.target.value}))}
                        />
                    </div>
                     <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Min Dividend</Label>
                        <Input 
                            type="number" 
                            placeholder="Min Div" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.dividendMoreThan}
                            onChange={e => setScreenerParams(p => ({...p, dividendMoreThan: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Max Dividend</Label>
                        <Input 
                            type="number" 
                            placeholder="Max Div" 
                            className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm placeholder:text-gray-700"
                            value={screenerParams.dividendLowerThan}
                            onChange={e => setScreenerParams(p => ({...p, dividendLowerThan: e.target.value}))}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Sector</Label>
                         <Select value={screenerParams.sector} onValueChange={v => setScreenerParams(p => ({...p, sector: v === "ALL" ? "" : v}))}>
                            <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm">
                                <SelectValue placeholder="Cualquiera" />
                            </SelectTrigger>
                            <SelectContent className="rounded-sm border-zinc-800 bg-zinc-950">
                                <SelectItem value="ALL">Todos</SelectItem>
                                {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Industry</Label>
                         <Select value={screenerParams.industry} onValueChange={v => setScreenerParams(p => ({...p, industry: v === "ALL" ? "" : v}))}>
                            <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm">
                                <SelectValue placeholder="Cualquiera" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 rounded-sm border-zinc-800 bg-zinc-950">
                                <SelectItem value="ALL">Todas</SelectItem>
                                {industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Country</Label>
                         <Select value={screenerParams.country} onValueChange={v => setScreenerParams(p => ({...p, country: v}))}>
                            <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm">
                                <SelectValue placeholder="País" />
                            </SelectTrigger>
                            <SelectContent className="rounded-sm border-zinc-800 bg-zinc-950">
                                <SelectItem value="US">United States</SelectItem>
                                <SelectItem value="UK">United Kingdom</SelectItem>
                                <SelectItem value="CA">Canada</SelectItem>
                                <SelectItem value="CN">China</SelectItem>
                                <SelectItem value="AR">Argentina</SelectItem>
                                <SelectItem value="BR">Brazil</SelectItem>
                                {/* Add more as needed */}
                            </SelectContent>
                        </Select>
                    </div>

                     <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Exchange</Label>
                         <Select value={screenerParams.exchange} onValueChange={v => setScreenerParams(p => ({...p, exchange: v === "ALL" ? "" : v}))}>
                            <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm">
                                <SelectValue placeholder="Cualquiera" />
                            </SelectTrigger>
                            <SelectContent className="rounded-sm border-zinc-800 bg-zinc-950">
                                <SelectItem value="ALL">Todos</SelectItem>
                                <SelectItem value="NASDAQ">NASDAQ</SelectItem>
                                <SelectItem value="NYSE">NYSE</SelectItem>
                                <SelectItem value="AMEX">AMEX</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1">
                        <Label className="text-[9px] uppercase tracking-wider text-gray-500">Limit</Label>
                         <Select value={screenerParams.limit} onValueChange={v => setScreenerParams(p => ({...p, limit: v}))}>
                            <SelectTrigger className="h-7 text-xs bg-zinc-900 border-zinc-800 rounded-sm">
                                <SelectValue placeholder="100" />
                            </SelectTrigger>
                            <SelectContent className="rounded-sm border-zinc-800 bg-zinc-950">
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="200">200</SelectItem>
                                <SelectItem value="500">500</SelectItem>
                                <SelectItem value="1000">1000</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="isEtf" 
                            checked={screenerParams.isEtf}
                            onCheckedChange={(c) => setScreenerParams(p => ({...p, isEtf: c as boolean}))}
                            className="border-zinc-700 data-[state=checked]:bg-[#0056FF] data-[state=checked]:border-[#0056FF] rounded-sm"
                        />
                        <Label htmlFor="isEtf" className="text-[10px] uppercase tracking-wider text-gray-400">Is ETF</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="isFund" 
                            checked={screenerParams.isFund}
                            onCheckedChange={(c) => setScreenerParams(p => ({...p, isFund: c as boolean}))}
                            className="border-zinc-700 data-[state=checked]:bg-[#0056FF] data-[state=checked]:border-[#0056FF] rounded-sm"
                        />
                        <Label htmlFor="isFund" className="text-[10px] uppercase tracking-wider text-gray-400">Is Fund</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="isActivelyTrading" 
                            checked={screenerParams.isActivelyTrading}
                            onCheckedChange={(c) => setScreenerParams(p => ({...p, isActivelyTrading: c as boolean}))}
                            className="border-zinc-700 data-[state=checked]:bg-[#0056FF] data-[state=checked]:border-[#0056FF] rounded-sm"
                        />
                        <Label htmlFor="isActivelyTrading" className="text-[10px] uppercase tracking-wider text-gray-400">Actively Trading</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox 
                            id="includeAllShareClasses" 
                            checked={screenerParams.includeAllShareClasses}
                            onCheckedChange={(c) => setScreenerParams(p => ({...p, includeAllShareClasses: c as boolean}))}
                            className="border-zinc-700 data-[state=checked]:bg-[#0056FF] data-[state=checked]:border-[#0056FF] rounded-sm"
                        />
                        <Label htmlFor="includeAllShareClasses" className="text-[10px] uppercase tracking-wider text-gray-400">All Share Classes</Label>
                    </div>
                </div>
                
                <div className="flex justify-end pt-2">
                     <Button size="sm" onClick={runScreener} disabled={loading} className="bg-[#0056FF] text-white hover:bg-[#0046CC] rounded-sm uppercase tracking-wider text-[10px] px-4 h-7 border-0">
                        {loading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Search className="w-3 h-3 mr-2" />}
                        Buscar
                     </Button>
                </div>
            </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin relative p-0 border border-t-0 border-zinc-800">
        <table className="w-full text-sm">
          <TableHeader className="sticky top-0 z-10 bg-[#1D1D1D]">
            <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[80px]">Ticker</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6">Company</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[80px]">Price</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[100px]">Mkt Cap</TableHead>
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[80px]">Div Yield</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                     <Loader2 className="w-4 h-4 animate-spin" /> Buscando...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStocks.length === 0 ? (
               <TableRow className="border-zinc-800">
                <TableCell colSpan={5} className="h-24 text-center text-gray-500 text-xs">
                  No se encontraron resultados.
                </TableCell>
              </TableRow>
            ) : (
              filteredStocks.map((stock) => (
                <TableRow 
                  key={stock.ticker} 
                  className="border-zinc-800 hover:bg-white/5 cursor-pointer transition-colors"
                  onClick={() => onStockSelect?.(stock.ticker)}
                >
                  <TableCell className="font-bold text-white px-2 py-0.5 text-xs">{stock.ticker}</TableCell>
                  <TableCell className="text-gray-400 px-2 py-0.5 text-[10px] truncate max-w-[200px]" title={stock.name}>{stock.name}</TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white">
                    {stock.price ? `$${stock.price.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-400">
                    {formatMarketCap(stock.marketCap || 0)}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-300">
                    {stock.divYield ? `${stock.divYield.toFixed(2)}%` : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
