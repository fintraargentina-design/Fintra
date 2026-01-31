"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMarketCap } from "@/lib/utils";
import { Loader2, AlertTriangle, ChevronUp, ChevronDown, Minus } from "lucide-react";
import { IFSData, IFSMemory, EnrichedStockData } from "@/lib/engine/types";
import { IFSRadial } from "@/components/visuals/IFSRadial";

// Helper to map raw Supabase snapshot to EnrichedStockData
export const mapSnapshotToStockData = (row: any): EnrichedStockData => {
  // Strict mapping from fintra_snapshots flat columns or JSONB structures
  
  // IFS Construction
  const rawIfs = row.ifs || {};
  const position = rawIfs.position || row.ifs_position;
  const pressure = rawIfs.pressure ?? 0;
  
  // New Model: Structural Persistence (IFS Memory)
  const ifsMemory = row.ifs_memory || null;

  let ifsData: IFSData | null = null;
  if (position) {
    ifsData = {
      position: position,
      pressure: Number(pressure)
    };
  }

  // Robust extraction for other fields (JSONB vs Flat)
  const marketPosition = row.market_position || {};
  const valuation = row.valuation || {};
  const marketSnapshot = row.market_snapshot || {};
  const marketState = row.market_state || {};
  const profileStructural = row.profile_structural || {};
  const financialScores = profileStructural.financial_scores || {};
  
  // FGOS Band: Check fgos_category (Table) and fgos_band (Legacy/View)
  const fgosBand = row.fgos_category || row.fgos_band || null;
  
  // FGOS Details
  // Use fgos_maturity if available (Mature, Developing, etc.), fallback to fgos_status (computed/pending)
  const fgosStatus = row.fgos_maturity || row.fgos_status || null;
  const sentimentBand = row.fgos_components?.sentiment_details?.band || null;

  // Sector Rank
  const sectorRank = row.sector_rank ?? marketPosition.sector_rank ?? null;
  const sectorRankTotal = row.sector_rank_total ?? marketPosition.sector_total_count ?? null;
  
  // Valuation Status
  const sectorValuationStatus = row.sector_valuation_status ?? valuation.valuation_status ?? null;

  // Price & Return
  // Use row.price (from market_state merge) as primary source for current price
  const priceEod = row.price ?? row.price_eod ?? marketSnapshot.price ?? marketSnapshot.price_eod ?? null;
  const ytdReturn = marketState.ytd_return ?? row.ytd_return ?? row.return_ytd ?? marketSnapshot.ytd_percent ?? null;
  const marketCap = marketState.market_cap ?? row.market_cap ?? marketSnapshot.market_cap ?? financialScores.marketCap ?? null;

  return {
    ticker: row.ticker,
    sectorRank,
    sectorRankTotal,
    sectorValuationStatus,
    fgosBand,
    fgosScore: row.fgos_score ?? null,
    fgosStatus,
    sentimentBand,
    ifs: ifsData,
    ifsMemory, // Return the memory structure
    strategyState: row.strategy_state ?? row.investment_verdict?.verdict_label ?? null,
    priceEod,
    ytdReturn,
    marketCap,
  };
};

// Helper Constants & Functions
const FGOS_BAND_ORDER: Record<string, number> = {
  strong: 1,
  defendable: 2,
  weak: 3,
};

const VALUATION_ORDER: Record<string, number> = {
  undervalued: 1,
  cheap_sector: 1,
  fairly_valued: 2,
  fair_sector: 2,
  overvalued: 3,
  expensive_sector: 3,
};

const getRankValue = (val: number | null | undefined) =>
  val == null ? Number.MAX_SAFE_INTEGER : val;

const getOrderValue = (val: string | null | undefined, map: Record<string, number>) => {
  if (!val) return Number.MAX_SAFE_INTEGER;
  const key = String(val).toLowerCase();
  return map[key] ?? Number.MAX_SAFE_INTEGER - 1;
};

export const sortStocksBySnapshot = (a: EnrichedStockData, b: EnrichedStockData) => {
  const srA = getRankValue(a.sectorRank);
  const srB = getRankValue(b.sectorRank);
  if (srA !== srB) return srA - srB;

  const fbA = getOrderValue(a.fgosBand, FGOS_BAND_ORDER);
  const fbB = getOrderValue(b.fgosBand, FGOS_BAND_ORDER);
  if (fbA !== fbB) return fbA - fbB;

  const valA = getOrderValue(a.sectorValuationStatus, VALUATION_ORDER);
  const valB = getOrderValue(b.sectorValuationStatus, VALUATION_ORDER);
  if (valA !== valB) return valA - valB;

  return a.ticker.localeCompare(b.ticker);
};

// --- New Visual Components ---

export const ValuationSignal = ({ status }: { status: string | null }) => {
  if (!status) return <div className="w-4 h-4" />;

  const lower = status.toLowerCase();
  let colorClass = "bg-zinc-700";
  let bars = 0;

  // Logic: Cheap = High Signal (Green), Fair = Med (Orange), Expensive = Low (Red)
  if (lower.includes("undervalued") || lower.includes("cheap")) {
    colorClass = "bg-green-500";
    bars = 4;
  } else if (lower.includes("fair")) {
    colorClass = "bg-orange-500";
    bars = 3;
  } else if (lower.includes("overvalued") || lower.includes("expensive")) {
    colorClass = "bg-red-500";
    bars = 2;
  }

  return (
    <div className="flex items-end gap-[1px] h-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`w-[2px] rounded-sm ${i <= bars ? colorClass : "bg-zinc-800"}`}
          style={{ height: `${i * 25}%` }}
        />
      ))}
    </div>
  );
};



const FGOSCell = ({ 
  score, 
  status, 
  sentiment 
}: { 
  score: number | null | undefined; 
  status: string | null | undefined;
  sentiment: string | null | undefined;
}) => {
  if (score == null) return <span className="text-zinc-600">—</span>;

  // Warning if status is not mature/developed or if score is weird
  // Heuristic matching image
  const isWarning = status === "Developing" || status === "Incomplete"; 

  // Sentiment Arrow
  let ArrowIcon = Minus;
  let arrowColor = "text-orange-500";
  
  if (sentiment === "optimistic") {
    ArrowIcon = ChevronUp;
    arrowColor = "text-green-500";
  } else if (sentiment === "pessimistic") {
    ArrowIcon = ChevronDown;
    arrowColor = "text-red-500";
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="w-4 flex justify-center">
        {isWarning && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
      </div>
      <span className="text-zinc-200 font-mono w-6 text-right">{score.toFixed(0)}</span>
      
      {/* Progress Bar */}
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden max-w-[60px]">
        <div 
          className="h-full bg-sky-500 rounded-full" 
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>

      {/* Sentiment Arrow */}
      <ArrowIcon className={`w-3 h-3 ${arrowColor}`} />
    </div>
  );
};

interface TablaIFSProps {
  data: EnrichedStockData[];
  isLoading: boolean;
  isFetchingMore?: boolean;
  onRowClick?: (ticker: string) => void;
  selectedTicker?: string | null;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollRef?: React.Ref<HTMLDivElement>;
  emptyMessage?: string;
}

export default function TablaIFS({
  data,
  isLoading,
  isFetchingMore = false,
  onRowClick,
  selectedTicker,
  onScroll,
  scrollRef,
  emptyMessage = "No se encontraron resultados."
}: TablaIFSProps) {
  // Debug logging
  React.useEffect(() => {
    if (data && data.length > 0) {
      console.log("📊 [DEBUG] TablaIFS Received Data (first 3):", data.slice(0, 3));
    }
  }, [data]);

  return (
    <div
      ref={scrollRef}
      className="w-full relative p-0 border-b border-zinc-800 bg-[#0A0A0A]" 
      onScroll={onScroll}
    >
      <table className="w-full text-sm border-collapse m-0 p-0">
        <TableHeader className="sticky top-0 z-10 bg-[#585757]">
          <TableRow className="border-[#1A1A1A] bg-[#585757] border-b border-[#1A1A1A]">
            <TableHead className="border-r border-[#1A1A1A] px-3 text-zinc-400 font-medium text-[12px] h-4 text-left w-[60px]">Ticker</TableHead>
            <TableHead className="border-r border-[#1A1A1A] px-1 text-zinc-400 font-medium text-[12px] h-4 text-left w-[40px]">V.R</TableHead>
            <TableHead className="border-r border-[#1A1A1A] px-2 text-zinc-400 font-medium text-[12px] h-4 text-left w-[60px]">Stage</TableHead>
            <TableHead className="border-r border-[#1A1A1A] px-2 text-zinc-400 font-medium text-[12px] h-4 text-right w-[120px]">FGOS</TableHead>
            <TableHead className="border-r border-[#1A1A1A] px-1 text-zinc-400 font-medium text-[12px] h-4 text-center w-[20px]">IFS</TableHead>
            <TableHead className="border-r border-[#1A1A1A] px-3 text-zinc-400 font-medium text-[12px] h-4 text-right w-[80px]">EOD</TableHead>
            <TableHead className="px-3 text-zinc-400 font-medium text-[12px] h-4 text-right w-[80px]">Mkt Cap</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="border-zinc-800">
              <TableCell colSpan={7} className="h-24 text-center">
                <div className="flex justify-center items-center gap-1 text-zinc-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos...
                </div>
              </TableCell>
            </TableRow>
          ) : (!data || data.length === 0) ? (
            <TableRow className="border-zinc-800">
              <TableCell colSpan={7} className="text-center text-zinc-500 py-1 text-xs">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((stock) => {
              const isSelected = selectedTicker === stock.ticker;
              return (
                <TableRow
                  key={stock.ticker}
                  className={`border-b-0 hover:bg-zinc-900/50 cursor-pointer transition-colors ${
                    isSelected ? "bg-zinc-700 border-l-4 border-l-[#002D72]" : ""
                  }`}
                  onClick={() => onRowClick?.(stock.ticker)}
                >
                  <TableCell className="border-r border-zinc-800 font-medium text-zinc-200 pl-1 py-0 text-xs">{stock.ticker}</TableCell>
                  
                  {/* V.R */}
                  <TableCell className="px-1 py-0 flex justify-center">
                    <ValuationSignal status={stock.sectorValuationStatus} />
                  </TableCell>
                  
                  {/* Stage */}
                  <TableCell className="border-r border-l border-zinc-800 text-zinc-400 px-1 py-0 text-[10px]">
                    {stock.fgosStatus || "—"}
                  </TableCell>
                  
                  {/* FGOS */}
                  <TableCell className="border-r border-zinc-800 px-1 py-0">
                    <FGOSCell 
                      score={stock.fgosScore} 
                      status={stock.fgosStatus} 
                      sentiment={stock.sentimentBand} 
                    />
                  </TableCell>
                  
                  {/* IFS */}
                  <TableCell className="px-1 py-0 flex justify-center">
                    <IFSRadial ifs={stock.ifs} ifsMemory={stock.ifsMemory} />
                  </TableCell>
                  
                  {/* EOD */}
                  <TableCell className="border-r border-l border-zinc-800 text-right px-1 py-0 text-xs font-mono text-zinc-200">
                    {stock.priceEod != null ? stock.priceEod.toFixed(2) : "—"}
                  </TableCell>
                  
                  {/* Mkt Cap */}
                  <TableCell className="text-right px-1 py-0 text-xs font-mono text-amber-500">
                    {stock.marketCap != null ? formatMarketCap(Number(stock.marketCap)) : "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
          {isFetchingMore && (
            <TableRow className="border-zinc-800">
              <TableCell colSpan={7} className="h-10 text-center text-zinc-600 text-xs">
                <div className="flex justify-center items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Cargando más...
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </table>
    </div>
  );
}
