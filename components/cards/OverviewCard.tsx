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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_0.5fr] gap-0 items-center border-b border-zinc-800 bg-[#1D1D1D] h-full">
            
            {/* 1. STOCK: Logo, Ticker, Nombre */}
            <div className="flex items-center gap-1 px-2 h-full">

                <div className="flex flex-col min-w-0 justify-center">
                    <span className="text-gray-400 text-[12px] leading-tight font-medium truncate max-w-[150px]" title={d.name || ""}>
                        {d.name || (loading || isParentLoading ? "Cargando..." : "N/A")}
                    </span>
                </div>
            </div>



            {/* 5. VER DATOS DETALLADOS */}
            <div className="flex flex-col items-center justify-center px-1 h-full text-center">
              {onExpandVerdict && (
                <Button
                  type="button"
                  onClick={onExpandVerdict}
                  variant="ghost"
                  size="icon"
                  className="p-1 h-5 w-5 bg-transparent"
                >
                  <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest flex items-center gap-1 hover:text-zinc-300">
                     Panel de Datos
                </span>
                  
                </Button>
              )}
              
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
