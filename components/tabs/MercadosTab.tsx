"use client";

import { useEffect, useState, useCallback } from "react";
import { fmp } from "@/lib/fmp/client";
import { Card } from "@/components/ui/card";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Globe, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExchangeMarketHours } from "@/lib/fmp/types";

// 1. Definición de Activos (Indices)
const MARKET_GROUPS = [
  {
    title: "INDICES US",
    tickers: ["^GSPC", "^IXIC", "^DJI", "^RUT", "^VIX"],
    names: { 
      "^GSPC": "S&P 500", 
      "^IXIC": "Nasdaq", 
      "^DJI": "Dow Jones", 
      "^RUT": "Russell 2000",
      "^VIX": "VIX Volatility"
    }
  },
  {
    title: "GLOBAL",
    tickers: ["^FTSE", "^N225", "^MXX", "^MERV", "^STOXX50E", "ASHR", "EWZ"],
    names: { 
      "^FTSE": "FTSE 100 (UK)", 
      "^N225": "Nikkei 225 (JP)", 
      "^MXX": "IPC (MX)", 
      "^MERV": "Merval (AR)",
      "^STOXX50E": "Euro Stoxx 50",
      "ASHR": "CSI 300 (China)",
      "EWZ": "Brazil (EWZ)"
    }
  },
  {
    title: "COMMODITIES",
    tickers: ["GCUSD", "CLUSD", "SIUSD", "NGUSD", "HGUSD", "ZSUSX"],
    names: { 
      "GCUSD": "Oro", 
      "CLUSD": "Petróleo WTI", 
      "SIUSD": "Plata", 
      "NGUSD": "Gas Natural",
      "HGUSD": "Cobre",
      "ZSUSX": "Soja"
    }
  },
  {
    title: "FOREX & CRYPTO",
    tickers: ["EURUSD", "USDJPY", "BTCUSD", "ETHUSD", "DX-Y.NYB"],
    names: { 
      "EURUSD": "EUR/USD", 
      "USDJPY": "USD/JPY", 
      "BTCUSD": "Bitcoin", 
      "ETHUSD": "Ethereum",
      "DX-Y.NYB": "DXY Index"
    }
  },
  {
    title: "BONOS US",
    tickers: ["US2YT", "^TNX", "^TYX"],
    names: { 
      "US2YT": "Treasury 02Y",
      "^TNX": "Treasury 10Y", 
      "^TYX": "Treasury 30Y" 
    }
  }
];

// Helper to collect all tickers
const ALL_TICKERS = MARKET_GROUPS.flatMap(g => g.tickers);

interface QuoteData {
  symbol: string;
  name?: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  timestamp: number;
}

// 2. Definición de Mercados (Horarios)
type ExtendedMarketHours = ExchangeMarketHours & {
  displayName: string;
  countryCode?: string;
};

const KEY_MARKETS = [
  { id: "nyse", name: "New York Stock Exchange", label: "NYSE", country: "US" },
  { id: "nasdaq", name: "NASDAQ", label: "NASDAQ", country: "US" },
  { id: "lse", name: "London Stock Exchange", label: "London", country: "GB" },
  { id: "tse", name: "Tokyo Stock Exchange", label: "Tokyo", country: "JP" },
  { id: "bcba", name: "Buenos Aires Stock Exchange", label: "Buenos Aires", country: "AR" },
  { id: "b3", name: "Sao Paulo Stock Exchange", label: "Sao Paulo", country: "BR" },
  { id: "shanghai", name: "Shanghai Stock Exchange", label: "Shanghai", country: "CN" },
  { id: "euronext", name: "Euronext", label: "Euronext", country: "EU" },
  { id: "tsx", name: "Toronto Stock Exchange", label: "Toronto", country: "CA" },
];

export default function MercadosTab() {
  // Estado para Cotizaciones
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [lastUpdatedQuotes, setLastUpdatedQuotes] = useState<Date | null>(null);

  // Estado para Horarios de Mercado
  const [marketHours, setMarketHours] = useState<ExtendedMarketHours[]>([]);
  const [loadingHours, setLoadingHours] = useState(true);
  const [errorHours, setErrorHours] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // --- Lógica de Cotizaciones ---
  const fetchQuotes = useCallback(async () => {
    setLoadingQuotes(true);
    try {
      const tickersString = ALL_TICKERS.join(',');
      const response = await fmp.quote(tickersString);
      
      const newQuotes: Record<string, QuoteData> = {};
      
      if (Array.isArray(response)) {
        response.forEach((item: any) => {
          newQuotes[item.symbol] = {
            symbol: item.symbol,
            name: item.name,
            price: item.price,
            changesPercentage: item.changesPercentage,
            change: item.change,
            dayLow: item.dayLow,
            dayHigh: item.dayHigh,
            yearHigh: item.yearHigh,
            yearLow: item.yearLow,
            timestamp: item.timestamp
          };
        });
      }
      
      setQuotes(newQuotes);
      setLastUpdatedQuotes(new Date());
    } catch (error) {
      console.error("Error fetching market data:", error);
    } finally {
      setLoadingQuotes(false);
    }
  }, []);

  // --- Lógica de Horarios de Mercado ---
  const fetchMarketHours = useCallback(async () => {
    setLoadingHours(true);
    setErrorHours(null);
    try {
      const res = await fmp.allMarketHours({ cache: 'no-store' });
      if (res && Array.isArray(res)) {
        const filtered = KEY_MARKETS.map((k) => {
          const matches = res.filter((m) => 
            m.name.toLowerCase().includes(k.name.toLowerCase()) || 
            (k.id === "nasdaq" && m.name.toLowerCase().includes("nasdaq")) ||
            (k.id === "euronext" && m.name.toLowerCase().includes("euronext"))
          );
          
          const found = matches.find(m => m.isMarketOpen) || matches[0];
          
          if (!found) return null;
          
          return {
            ...found,
            displayName: k.label,
            countryCode: k.country
          };
        }).filter(Boolean) as ExtendedMarketHours[];

        setMarketHours(filtered);
      }
    } catch (err) {
      console.error("Error fetching market hours:", err);
      setErrorHours("Error al cargar horarios");
    } finally {
      setLoadingHours(false);
    }
  }, []);

  // Efectos de carga inicial e intervalos
  useEffect(() => {
    fetchQuotes();
    fetchMarketHours();
    setNow(new Date());
    
    const quoteInterval = setInterval(fetchQuotes, 60000); // 60s refresh quotes
    const hoursInterval = setInterval(fetchMarketHours, 60000); // 60s refresh hours
    const clockInterval = setInterval(() => setNow(new Date()), 1000); // 1s clock

    return () => {
      clearInterval(quoteInterval);
      clearInterval(hoursInterval);
      clearInterval(clockInterval);
    };
  }, [fetchQuotes, fetchMarketHours]);

  const handleRefreshAll = () => {
    fetchQuotes();
    fetchMarketHours();
  };

  // Helpers de formateo
  const formatPrice = (price: number, symbol: string) => {
    if (!price) return "N/A";
    if (symbol.includes("USD") && !symbol.startsWith("^") && symbol.length === 6) return price.toFixed(4);
    if (symbol.includes("BTC") || symbol.includes("ETH")) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change: number) => {
    if (change === undefined || change === null) return "0.00%";
    return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  const getHeatmapColor = (change: number | undefined) => {
    if (change === undefined || change === null) return "#1e293b"; 
    if (change >= 3.0) return "#006000";
    if (change >= 2.0) return "#004D00";
    if (change >= 1.0) return "#003300";
    if (change >= 0.0) return "#001A00";
    if (change <= -3.0) return "#600000";
    if (change <= -2.0) return "#4D0000";
    if (change <= -1.0) return "#330000";
    return "#1A0000";
  };

  const formatTimeInZone = (timezone?: string) => {
    if (!timezone || !now) return "--:--:--";
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: timezone
      }).format(now);
    } catch (e) {
      return "--:--:--";
    }
  };

  const isLoading = loadingQuotes || loadingHours;

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Header General */}
      <div className="relative flex items-center justify-center px-1 py-1 border-b border-zinc-800 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Mercados Globales <span className="text-zinc-600 mx-1">•</span> <span className="text-[#FFA028]">{lastUpdatedQuotes ? lastUpdatedQuotes.toLocaleTimeString() : '---'}</span>
        </h4>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefreshAll} 
          disabled={isLoading}
          className="absolute right-1 h-5 w-5 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-0 pb-2">
        {/* 1. Cotizaciones de Indices */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-0.5">
          {MARKET_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <div className="bg-[#333] text-zinc-100 px-3 py-1 text-xs tracking-wider text-center">
                {group.title}
              </div>
              <div className="flex flex-col gap-0.5"> 
                {group.tickers.map((ticker) => {
                  const data = quotes[ticker];
                  const name = group.names[ticker as keyof typeof group.names] || ticker;
                  const change = data?.changesPercentage;
                  const absChange = data?.change;
                  
                  return (
                    <Card 
                      key={ticker}
                      className="border-none transition-all hover:brightness-110 cursor-default overflow-hidden relative shadow-sm"
                      style={{ backgroundColor: getHeatmapColor(change) }}
                    >
                      <div className="p-1 flex flex-col justify-between h-[100px]">
                        <div className="flex justify-between items-start w-full">
                          <span className="text-white text-[11px] leading-tight line-clamp-2 max-w-[70%]">
                            {name}
                          </span>
                           {change !== undefined && (
                             <div className="opacity-50">
                                {change > 0 ? <TrendingUp className="w-3 h-3 text-white" /> : change < 0 ? <TrendingDown className="w-3 h-3 text-white" /> : <Minus className="w-3 h-3 text-white" />}
                             </div>
                           )}
                        </div>

                        <div className="flex-1 flex items-center justify-end pr-2">
                           <span className="text-2xl text-white tracking-tighter">
                             {data ? formatChange(change) : "---"}
                           </span>
                        </div>
                        
                        <div className="flex justify-between items-end w-full mt-1 border-t border-white/10 pt-1">
                          <div className="flex items-baseline gap-1">
                             <span className="text-[10px] font-medium text-white/80">{ticker}</span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-xs font-medium text-white leading-none">
                               {data ? formatPrice(data.price, ticker) : "---"}
                             </span>
                             <span className="text-[10px] text-white/70">
                               {data && absChange !== undefined ? (absChange > 0 ? "+" : "") + absChange.toFixed(2) : ""}
                             </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Separador */}
        <div className="mt-6 mb-2 px-3 border-b border-zinc-800 pb-1 flex justify-between items-center">
           <h4 className="text-xs font-medium text-gray-400">Horarios de Mercado Global</h4>
           <span className="text-[10px] text-zinc-500 font-mono">{now ? now.toLocaleTimeString() : '--:--:--'}</span>
        </div>

        {/* 2. Horarios de Mercado */}
        <div className="px-0.5">
           {loadingHours && marketHours.length === 0 ? (
             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-0.5 p-0.5">
               {[...Array(10)].map((_, i) => (
                 <div key={i} className="h-24 bg-zinc-900/50 animate-pulse" />
               ))}
             </div>
           ) : errorHours ? (
             <div className="flex items-center justify-center p-4 text-zinc-500 text-xs">
               {errorHours}
             </div>
           ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-0.5">
              {marketHours.map((market, idx) => (
                <Card 
                  key={`${market.name}-${idx}`}
                  className={`
                    border-none transition-all hover:brightness-110 cursor-default overflow-hidden relative shadow-sm rounded-none
                    ${market.isMarketOpen ? 'bg-[#001A00]' : 'bg-[#1A0000]'}
                  `}
                >
                  <div className="p-3 flex flex-col justify-between h-[140px]">
                    {/* Header: Name + Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-white text-[11px] font-semibold flex items-center gap-1.5">
                          <Globe className="w-3 h-3 text-zinc-400" />
                          {market.displayName}
                        </span>
                        <span className="text-[9px] text-zinc-400 truncate max-w-[100px]" title={market.timezone}>
                          {market.timezone?.replace('America/', '').replace('Europe/', '').replace('Asia/', '')}
                        </span>
                      </div>
                      
                      <Badge 
                        variant="outline" 
                        className={`
                          text-[9px] px-1 py-0 h-4 border-0 font-bold
                          ${market.isMarketOpen 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'}
                        `}
                      >
                        {market.isMarketOpen ? 'OPEN' : 'CLOSED'}
                      </Badge>
                    </div>

                    {/* Big Clock Center */}
                    <div className="flex items-center justify-center my-2">
                      <span className="text-3xl font-mono font-bold text-white tracking-wider">
                        {formatTimeInZone(market.timezone).slice(0, 5)}
                        <span className="text-sm text-zinc-500 ml-1 align-top mt-1 inline-block">
                           {formatTimeInZone(market.timezone).slice(6)}
                        </span>
                      </span>
                    </div>

                    {/* Hours */}
                    <div className="mt-1 pt-1 border-t border-white/5 flex flex-col gap-0.5 justify-end">
                      <div className="flex items-center justify-between text-[10px] leading-tight">
                        <span className="text-zinc-500">{market.openingAdditional ? 'Sesión 1' : 'Horario'}</span>
                        <span className="text-zinc-300 font-mono">
                          {market.openingHour?.replace(/\s[+-]\d{2}:\d{2}$/, "")} - {market.closingHour?.replace(/\s[+-]\d{2}:\d{2}$/, "")}
                        </span>
                      </div>
                      {market.openingAdditional && (
                        <div className="flex items-center justify-between text-[10px] leading-tight">
                          <span className="text-zinc-500">Sesión 2</span>
                          <span className="text-zinc-300 font-mono">
                            {market.openingAdditional?.replace(/\s[+-]\d{2}:\d{2}$/, "")} - {market.closingAdditional?.replace(/\s[+-]\d{2}:\d{2}$/, "")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
           )}
        </div>
      </div>
    </div>
  );
}
