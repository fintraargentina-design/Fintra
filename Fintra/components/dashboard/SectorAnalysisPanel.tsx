"use client";
// Fintra/components/dashboard/SectorAnalysisPanel.tsx
// VERSIÓN CORREGIDA - Orchestrates Table and Chart
import { useState, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { FintraLoader } from "@/components/ui/FintraLoader";
import TablaIFS from "./TablaIFS";
import SectorScatterChart from "./SectorScatterChart";
import { useSectorData } from "@/hooks";
import { MOCK_DATA } from "./mock-data";

interface SectorAnalysisPanelProps {
  onStockSelect?: (symbol: string) => void;
  selectedTicker?: string;
  sectors?: any[];
  selectedSector?: string;
  industries?: any[];
  selectedIndustry?: string;
  selectedCountry?: string;
}

export default function SectorAnalysisPanel({
  onStockSelect,
  selectedTicker,
  sectors = [],
  selectedSector,
  industries = [],
  selectedIndustry = "Todas",
  selectedCountry,
}: SectorAnalysisPanelProps) {
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  // Scroll Ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // MOCK MODE TOGGLE
  const USE_MOCK = false;

  // Use custom hook for data fetching
  const {
    stocks,
    loading,
    isFetchingMore,
    error,
    dataQuality,
    hasMore,
    fetchMore,
  } = useSectorData({
    selectedSector,
    selectedIndustry,
    selectedCountry,
  });

  // Handle row hover from Table
  const handleRowHover = (ticker: string | null) => {
    setHoveredTicker(ticker);
  };

  // Sort stocks by Market Cap (Descending)
  const sortedStocks = [...stocks].sort((a, b) => {
    return (b.marketCap || 0) - (a.marketCap || 0);
  });

  return (
    <div className="w-full h-full flex flex-col gap-1 p-2 bg-[#0e0e0e]">
      {/* 1. SCATTER CHART SECTION */}
      <div className="flex-none bg-[#111] border border-[#222] rounded-xs shadow-sm overflow-hidden p-3 relative group transition-all hover:border-[#333]">
        <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Optional: Add controls here if needed */}
        </div>
        <div className="h-[350px] w-full">
          {stocks.length > 0 ? (
            <SectorScatterChart
              data={stocks}
              onPointClick={onStockSelect}
              activeTicker={selectedTicker}
              hoveredTicker={hoveredTicker}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#444] text-xs gap-2">
              {loading ? (
                <>
                  <FintraLoader size={20} />
                  <span>Loading market data...</span>
                </>
              ) : (
                <span>Waiting for data...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. TABLE SECTION */}
      <div className="flex-1 min-h-0 bg-[#0e0e0e] border border-[#2a2a2a] rounded-xs shadow-sm flex flex-col overflow-hidden relative group transition-all hover:border-[#444]">
        
        {/* Data Quality Warning */}
        {dataQuality.completeness < 50 && !loading && stocks.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/20 border-b border-amber-900/30 text-amber-500 text-[10px]">
            <AlertTriangle className="w-3 h-3" strokeWidth={2} />
            <span>
              Low data coverage ({dataQuality.completeness.toFixed(0)}%). Some
              metrics may be estimated.
            </span>
          </div>
        )}

        <div
          className="flex-1 overflow-hidden relative"
          ref={scrollContainerRef}
        >
          <TablaIFS
            data={sortedStocks}
            isLoading={loading}
            isFetchingMore={isFetchingMore}
            onRowClick={onStockSelect}
            onRowHover={handleRowHover}
            selectedTicker={selectedTicker}
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (scrollHeight - scrollTop - clientHeight < 50) {
                if (hasMore && !isFetchingMore && !loading) {
                  fetchMore();
                }
              }
            }}
          />
        </div>

        {/* Footer / Status Bar */}
        <div className="h-7 border-t border-[#2a2a2a] bg-[#0e0e0e] flex items-center justify-between px-3 text-[10px] text-zinc-500 select-none">
          <div className="flex items-center gap-2">
            <span>{stocks.length} Companies</span>
            {isFetchingMore && (
              <span className="text-zinc-500 animate-pulse">
                Fetching more...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-zinc-500">Sector:</span>
              <span className="text-zinc-300 font-medium">
                {selectedSector || "All"}
              </span>
              <span className="text-zinc-700 mx-1">/</span>
              <span className="text-zinc-500">Industry:</span>
              <span className="text-zinc-300 font-medium">
                {selectedIndustry || "All"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
