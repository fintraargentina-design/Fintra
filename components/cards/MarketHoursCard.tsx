"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmp } from "@/lib/fmp/client";
import type { ExchangeMarketHours } from "@/lib/fmp/types";

// Extended type for internal use
type ExtendedMarketHours = ExchangeMarketHours & {
  displayName: string;
  countryCode?: string;
};

// Mercados clave a mostrar y sus banderas/nombres amigables
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

export default function MarketHoursCard() {
  const [data, setData] = useState<ExtendedMarketHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fmp.allMarketHours({ cache: 'no-store' });
      if (res && Array.isArray(res)) {
        // Filtrar y ordenar según nuestra lista de KEY_MARKETS
        const filtered = KEY_MARKETS.map((k) => {
          // Buscar coincidencia relajada por nombre (puede haber múltiples entradas para sesiones AM/PM)
          const matches = res.filter((m) => 
            m.name.toLowerCase().includes(k.name.toLowerCase()) || 
            (k.id === "nasdaq" && m.name.toLowerCase().includes("nasdaq")) ||
            (k.id === "euronext" && m.name.toLowerCase().includes("euronext"))
          );
          
          // Priorizar mercado ABIERTO si existe (para manejar sesiones divididas como en Asia)
          const found = matches.find(m => m.isMarketOpen) || matches[0];
          
          // Si no se encuentra, devolvemos un objeto placeholder (o null para filtrar después)
          if (!found) return null;
          
          return {
            ...found,
            displayName: k.label,
            countryCode: k.country
          };
        }).filter(Boolean) as ExtendedMarketHours[];

        setData(filtered);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Error fetching market hours:", err);
      setError("Error al cargar horarios de mercado");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    // Auto refresh every minute
    const interval = setInterval(fetchMarkets, 60000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // Clock effect
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeInZone = (timezone?: string) => {
    if (!timezone) return "--:--:--";
    try {
      // FMP devuelve timezones como "America/New_York", etc.
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

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] overflow-hidden">
      <div className="relative flex items-center justify-center px-1 py-1 border-b border-zinc-800 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Horarios de Mercado Global <span className="text-zinc-600 mx-1">•</span> <span className="text-[#FFA028]">{lastUpdated ? lastUpdated.toLocaleTimeString() : '---'}</span>
        </h4>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => fetchMarkets()} 
          disabled={loading}
          className="absolute right-1 h-5 w-5 text-zinc-500 hover:text-zinc-300 hover:bg-transparent"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 p-0 pb-2 overflow-y-auto">
        {loading && data.length === 0 ? (
           <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-0.5 p-0.5">
             {[...Array(10)].map((_, i) => (
               <div key={i} className="h-24 bg-zinc-900/50 animate-pulse" />
             ))}
           </div>
        ) : error ? (
           <div className="flex items-center justify-center h-full text-zinc-500 text-xs">
             {error}
           </div>
        ) : (
         <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-0.5 p-0.5">
            {data.map((market, idx) => (
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
                      {/* <span className="text-[9px] text-zinc-400 truncate max-w-[100px]" title={market.timezone}>
                        {market.timezone?.replace('America/', '').replace('Europe/', '').replace('Asia/', '')}
                      </span> */}
                    </div>
                    
                    {/* <Badge 
                      variant="outline" 
                      className={`
                        text-[9px] px-1 py-0 h-4 border-0 font-bold
                        ${market.isMarketOpen 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'}
                      `}
                    >
                      {market.isMarketOpen ? 'OPEN' : 'CLOSED'}
                    </Badge> */}
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
  );
}
