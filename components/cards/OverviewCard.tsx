"use client";
// Fintra/components/cards/OverviewCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useMemo } from "react";
import { Activity } from "lucide-react";

import { getOverviewData, OverviewData } from "@/lib/repository/fintra-db";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewCardProps {
  selectedStock: any | string | null;
  onStockSearch?: (symbol: string) => Promise<any> | any;
  isParentLoading?: boolean;
  analysisData?: any;
}

export default function OverviewCard({
  selectedStock,
  onStockSearch,
  isParentLoading = false,
  analysisData
}: OverviewCardProps) {
  // ── Estados ──
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Símbolo actual robusto
  const currentSymbol = useMemo(() => {
    if (typeof selectedStock === "string")
      return selectedStock?.toUpperCase?.() || "";
    return (selectedStock?.symbol || "").toUpperCase();
  }, [selectedStock]);

  // 1. Fetch Consolidated Data (Single Source of Truth)
  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!currentSymbol) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const overview = await getOverviewData(currentSymbol);
        if (active) {
            setData(overview);
        }
      } catch (err) {
        console.error("Error fetching overview data:", err);
        if (active) setError("Error cargando datos");
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    return () => { active = false; };
  }, [currentSymbol]);


  // ── Render Helpers ──
  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-green-400";
    if (s >= 50) return "text-yellow-400";
    return "text-red-400";
  };

  const getValBadge = (v: string | null | undefined) => {
    if (!v) return <Badge className="text-gray-400 bg-gray-400/10 border-gray-400 px-2 py-0.5 text-xs" variant="outline">N/A</Badge>;
    
    const lowerV = v.toLowerCase();
    if (lowerV.includes("under") || lowerV.includes("infra") || lowerV.includes("barata")) {
      return <Badge className="text-green-400 bg-green-400/10 border-green-400 px-2 py-0.5 text-xs" variant="outline">Infravalorada</Badge>;
    }
    if (lowerV.includes("over") || lowerV.includes("sobre") || lowerV.includes("cara")) {
      return <Badge className="text-red-400 bg-red-400/10 border-red-400 px-2 py-0.5 text-xs" variant="outline">Sobrevalorada</Badge>;
    }
    return <Badge className="text-yellow-400 bg-yellow-400/10 border-yellow-400 px-2 py-0.5 text-xs" variant="outline">Justa</Badge>;
  };

  // ── Render Principal ──

  if ((loading || isParentLoading) && !data) {
    return (
      <Card className="bg-tarjetas border-none flex items-center justify-center w-full h-full">
        <CardContent className="p-0 flex items-center justify-center w-full h-full">
          <div className="text-gray-500 text-sm">Cargando ticker...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-tarjetas flex items-center flex-col w-full justify-between p-0 h-full">
        <CardContent className="p-0 flex items-center justify-center w-full h-full">
          <div className="text-red-400">{error}</div>
        </CardContent>
      </Card>
    );
  }

  // Use local variable for easier access, falling back to null if data is null (shouldn't happen if not loading)
  const d = data || {
      ticker: currentSymbol,
      name: null,
      logo_url: null,
      price: null,
      change_percentage: null,
      fgos_score: null,
      valuation_status: null,
      verdict_text: null,
      ecosystem_score: null
  };

  return (
    <Card className="bg-tarjetas border-none shadow-lg w-full h-full flex flex-col group relative overflow-hidden rounded-none">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] gap-0 items-center border-b border-zinc-800 bg-[#1D1D1D] h-full">
            
            {/* 1. STOCK: Logo, Ticker, Nombre */}
            <div className="flex items-center gap-1 px-0.5 h-full">
                  <div className="relative h-full aspect-square flex items-center justify-center overflow-hidden border-none rounded-none shrink-0">
                    {d.logo_url ? (
                      <img 
                        src={d.logo_url} 
                        alt={d.ticker || "Logo"} 
                        className="w-10 h-10 object-contain p-0"
                        onError={(e: any) => {
                           e.currentTarget.style.display = 'none';
                           const span = e.currentTarget.parentElement?.querySelector('.fallback-text') as HTMLElement;
                           if (span) span.style.display = 'block';
                        }}
                      />
                    ) : null}
                    <span className="fallback-text text-white font-bold text-xs" style={{ display: d.logo_url ? 'none' : 'block' }}>
                      {(d.ticker || currentSymbol)?.slice(0, 2) || "??"}
                    </span>
                  </div>
                <div className="flex flex-col min-w-0 justify-center">
                    <span className="text-gray-400 text-[12px] leading-tight font-medium truncate max-w-[150px]" title={d.name || ""}>
                        {d.name || (loading || isParentLoading ? "Cargando..." : "N/A")}
                    </span>
                </div>
            </div>

            {/* 2. PRECIO */}
            <div className="flex flex-col items-center justify-center gap-1 px-1 py-1 h-full">
                <div className="text-base text-white leading-none">
                  {Number.isFinite(Number(d.price)) ? `$${Number(d.price).toFixed(2)}` : "N/A"}
                </div>
                <span className="text-[9px] uppercase text-zinc-600 font-bold">Precio</span>
                {/* <div className={`text-[10px] font-medium ${Number(d.change_percentage ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number(d.change_percentage ?? 0) >= 0 ? "+" : ""}{Number.isFinite(Number(d.change_percentage)) ? Number(d.change_percentage).toFixed(2) : "0.00"}%
                </div> */}
            </div>

            {/* 3. FGOS */}
            <div className="flex flex-col items-center justify-center px-1 gap-1 h-full">
                
                {Number.isFinite(d.fgos_score) ? (
                   <div className={`text-lg font-black leading-none ${getScoreColor(d.fgos_score!)}`}>{d.fgos_score}</div>
                ) : loading ? (
                  <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                ) : (
                  <div className="text-lg font-black leading-none text-zinc-700">-</div>
                )}
<span className="text-[9px] uppercase text-zinc-500 font-bold">I.F.S.</span>

            </div>

            {/* 4. VALUACIÓN */}
            <div className="flex flex-col items-center justify-center px-1 gap-1 h-full">
                
                {d.valuation_status ? (
                   getValBadge(d.valuation_status)
                ) : loading ? (
                  <Skeleton className="h-5 w-20 bg-white/10 rounded-full" />
                ) : (
                   getValBadge(null)
                )}
                <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-widest ">VALUACIÓN</span>
            </div>

            {/* 5. VEREDICTO */}
            <div className="flex flex-col items-center justify-center px-2 h-full text-center">
                {/* <span className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest mb-1">VERDICT FINTRA</span> */}
                {d.verdict_text ? (
                  <span className="text-white font-medium text-[10px] leading-tight max-w-[150px] line-clamp-2" title={d.verdict_text}>
                      {d.verdict_text}
                  </span>
                ) : loading ? (
                  <Skeleton className="h-4 w-24 bg-white/10 rounded-sm" />
                ) : (
                   <span className="text-zinc-600 text-[10px]">N/A</span>
                )}
            </div>

            {/* 6. EHS */}
            <div className="flex flex-col items-center justify-center px-1 gap-1 h-full">
                
                {Number.isFinite(d.ecosystem_score) ? (
                   <div className="flex flex-col items-center">
                      <div className="text-lg font-mono text-blue-400 font-bold leading-none">{d.ecosystem_score}</div>
                      
                   </div>
                ) : loading ? (
                  <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                ) : (
                   <div className="text-lg font-mono text-zinc-700 font-bold leading-none">-</div>
                )}
                <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-widest flex items-center gap-1 mb-0.5">
                    ECOSISTEMA
                </span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
