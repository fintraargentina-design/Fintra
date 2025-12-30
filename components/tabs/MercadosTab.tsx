"use client";

import { useEffect, useState, useCallback } from "react";
import { fmp } from "@/lib/fmp/client";
import { Card } from "@/components/ui/card";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

// 1. Definición de Activos
const MARKET_GROUPS = [
  {
    title: "INDICES US",
    tickers: ["^GSPC", "^IXIC", "^DJI", "^RUT"],
    names: { 
      "^GSPC": "S&P 500", 
      "^IXIC": "Nasdaq", 
      "^DJI": "Dow Jones", 
      "^RUT": "Russell 2000" 
    }
  },
  {
    title: "GLOBAL",
    tickers: ["^FTSE", "^N225", "^MXX", "^MERV"],
    names: { 
      "^FTSE": "FTSE 100 (UK)", 
      "^N225": "Nikkei 225 (JP)", 
      "^MXX": "IPC (MX)", 
      "^MERV": "Merval (AR)" 
    }
  },
  {
    title: "COMMODITIES",
    tickers: ["GC=F", "CL=F", "SI=F", "NG=F"],
    names: { 
      "GC=F": "Oro", 
      "CL=F": "Petróleo WTI", 
      "SI=F": "Plata", 
      "NG=F": "Gas Natural" 
    }
  },
  {
    title: "FOREX & CRYPTO",
    tickers: ["EURUSD", "USDJPY", "BTCUSD", "ETHUSD"],
    names: { 
      "EURUSD": "EUR/USD", 
      "USDJPY": "USD/JPY", 
      "BTCUSD": "Bitcoin", 
      "ETHUSD": "Ethereum" 
    }
  },
  {
    title: "BONOS US",
    tickers: ["^TNX", "^TYX"],
    names: { 
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

export default function MercadosTab() {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // FMP allows comma separated tickers
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
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching market data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and interval
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // 60s refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatPrice = (price: number, symbol: string) => {
    if (!price) return "N/A";
    // Currency pairs usually need 4 decimals, others 2
    if (symbol.includes("USD") && !symbol.startsWith("^") && symbol.length === 6) return price.toFixed(4);
    if (symbol.includes("BTC") || symbol.includes("ETH")) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatChange = (change: number) => {
    if (change === undefined || change === null) return "0.00%";
    return `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  };

  // Heatmap Logic adapted for Percentage Change
  const getHeatmapColor = (change: number | undefined) => {
    if (change === undefined || change === null) return "#1e293b"; // Neutral Grey
    
    // Positive Scale (Green)
    if (change >= 3.0) return "#006000"; // Strong Green
    if (change >= 2.0) return "#004D00";
    if (change >= 1.0) return "#003300";
    if (change >= 0.0) return "#001A00"; // Very Dark Green
    
    // Negative Scale (Red)
    if (change <= -3.0) return "#600000"; // Strong Red
    if (change <= -2.0) return "#4D0000";
    if (change <= -1.0) return "#330000";
    return "#1A0000"; // Very Dark Red
  };

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      <div className="relative flex items-center justify-center px-1 py-1 border-b border-zinc-800 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Mercados Globales <span className="text-zinc-600 mx-1">•</span> <span className="text-[#FFA028]">{lastUpdated ? lastUpdated.toLocaleTimeString() : '---'}</span>
        </h4>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => fetchData()} 
          disabled={loading}
          className="absolute right-1 h-5 w-5 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-1 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-1">
          {MARKET_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <div className="bg-[#333] text-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-wider border-l-4 border-[#FFA028]">
                {group.title}
              </div>
              <div className="flex flex-col gap-1"> 
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
                      <div className="p-3 flex flex-col justify-between h-[100px]">
                        {/* Top: Name and Ticker */}
                        <div className="flex justify-between items-start w-full">
                          <span className="text-white font-bold text-[11px] leading-tight line-clamp-2 max-w-[70%]">
                            {name}
                          </span>
                           {change !== undefined && (
                             <div className="opacity-50">
                                {change > 0 ? <TrendingUp className="w-3 h-3 text-white" /> : change < 0 ? <TrendingDown className="w-3 h-3 text-white" /> : <Minus className="w-3 h-3 text-white" />}
                             </div>
                           )}
                        </div>

                        {/* Middle: Big Percentage Change */}
                        <div className="flex-1 flex items-center justify-end pr-2">
                           <span className="text-2xl font-bold text-white tracking-tighter">
                             {data ? formatChange(change) : "---"}
                           </span>
                        </div>
                        
                        {/* Bottom: Price and Absolute Change */}
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
      </div>
    </div>
  );
}
