"use client";
// Fintra/components/cards/OverviewCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo } from "react";
import { Activity, Maximize2 } from "lucide-react";

import { getOverviewData, OverviewData } from "@/lib/repository/fintra-db";
import { Skeleton } from "@/components/ui/skeleton";
import { FgosScoreCell } from "@/components/ui/FgosScoreCell";
import { getValBadge, getRelativeReturnLabel } from "../dashboard/TableUtils";

interface OverviewCardProps {
  selectedStock: any | string | null;
  onStockSearch?: (symbol: string) => Promise<any> | any;
  isParentLoading?: boolean;
  analysisData?: any;
  onExpandVerdict?: () => void;
}

export default function OverviewCard({
  selectedStock,
  onStockSearch,
  isParentLoading = false,
  analysisData,
  onExpandVerdict
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
      ecosystem_score: null,
      relative_return: null
  };

  return (
    <Card className="bg-tarjetas border-none shadow-lg w-full h-full flex flex-col group relative overflow-hidden rounded-none">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_.5fr] gap-0 items-center border-b border-zinc-800 bg-[#1D1D1D] h-full">
            
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
            <div className="flex flex-col items-center justify-center px-1 py-1 h-full">
                <div className="text-base text-white leading-none">
                  {Number.isFinite(Number(d.price)) ? `$${Number(d.price).toFixed(2)}` : "N/A"}
                </div>
                <span className="text-[10px] uppercase text-zinc-500 font-bold">Precio</span>
                {/* <div className={`text-[10px] font-medium ${Number(d.change_percentage ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number(d.change_percentage ?? 0) >= 0 ? "+" : ""}{Number.isFinite(Number(d.change_percentage)) ? Number(d.change_percentage).toFixed(2) : "0.00"}%
                </div> */}
            </div>

            {/* 3. FGOS */}
            <div className="flex flex-col items-center justify-center px-1 h-full">
                
                {Number.isFinite(d.fgos_score) ? (
                  <FgosScoreCell score={d.fgos_score as number} confidenceLabel={undefined} />
                ) : loading ? (
                  <Skeleton className="h-6 w-10 bg-white/10 rounded-sm" />
                ) : (
                  <div className="text-lg font-black leading-none text-zinc-700">-</div>
                )}
                <span className="text-[10px] uppercase text-zinc-500 font-bold">I.F.S.</span>

            </div>

            {/* 4. VALUACIÓN */}
            <div className="flex flex-col items-center justify-center px-1 h-full">
                
                {d.valuation_status ? (
                   getValBadge(d.valuation_status)
                ) : loading ? (
                  <Skeleton className="h-5 w-30 bg-white/10 rounded-full" />
                ) : (
                   getValBadge(null)
                )}
                <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest ">Valuación Sectorial</span>
            </div>

            
            {/* 5. Resultado relativo */}
            <div className="flex flex-col items-center justify-center px-1 h-full">
                {d.relative_return ? (
                   <div className="flex flex-col items-center">
                      <div className="text-[10px] text-gray-300 font-medium leading-none text-center">
                        {getRelativeReturnLabel(d.relative_return)}
                      </div>
                   </div>
                ) : loading ? (
                  <Skeleton className="h-6 w-16 bg-white/10 rounded-sm" />
                ) : (
                   <div className="text-lg font-mono text-zinc-700 font-bold leading-none">-</div>
                )}
                <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest flex items-center gap-1 mb-0.5">
                    RESULTADO RELATIVO
                </span>
            </div>

            {/* 5. VER DATOS DETALLADOS */}
            <div className="flex flex-col items-center justify-center px-2 h-full text-center">
              {onExpandVerdict && (
                <Button
                  type="button"
                  onClick={onExpandVerdict}
                  variant="ghost"
                  size="icon"
                  className="p-1 h-5 w-5 text-zinc-500 hover:text-zinc-300 transition-colors bg-transparent"
                >
                  <Maximize2 className="w-3 h-3" />
                </Button>
              )}
              <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest flex items-center gap-1 mb-0.5">
                     EXPANDIR
                </span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
