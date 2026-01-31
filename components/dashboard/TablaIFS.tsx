"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMarketCap } from "@/lib/utils";
import { Loader2, AlertTriangle, ChevronUp, ChevronDown, Minus } from "lucide-react";

// Shared interface
export interface EnrichedStockData {
  ticker: string;
  sectorRank: number | null;
  sectorRankTotal: number | null;
  sectorValuationStatus: string | null;
  fgosBand: string | null;
  fgosScore?: number | null;
  fgosStatus?: string | null; // e.g. Mature, Developing
  sentimentBand?: string | null; // e.g. optimistic, neutral
  ifs?: {
    position: "leader" | "follower" | "laggard";
    pressure: number;
  } | null;
  strategyState: string | null;
  priceEod: number | null;
  priceChange?: number | null;
  ytdReturn: number | null;
  marketCap: number | null;
  totalDebt?: number | null;
  revenue?: number | null;
}

// Helper to map raw Supabase snapshot to EnrichedStockData
export const mapSnapshotToStockData = (row: any): EnrichedStockData => {
  // Strict mapping from fintra_snapshots flat columns or JSONB structures
  
  // IFS Construction
  // Handle both flat columns (legacy/view) and JSONB 'ifs' column
  const rawIfs = row.ifs || {};
  const position = rawIfs.position || row.ifs_position;
  const pressure = rawIfs.pressure ?? row.ifs_pressure ?? 0;

  let ifsData = null;
  if (position) {
    ifsData = {
      position: position,
      pressure: pressure
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
  const priceEod = row.price_eod ?? marketSnapshot.price ?? marketSnapshot.price_eod ?? null;
  const priceChange = row.price_change ?? marketSnapshot.change ?? marketState.price_change ?? null;
  const ytdReturn = marketState.ytd_return ?? row.return_ytd ?? marketSnapshot.ytd_percent ?? null;
  const marketCap = marketState.market_cap ?? row.market_cap ?? marketSnapshot.market_cap ?? financialScores.marketCap ?? null;
  const totalDebt = row.total_debt ?? financialScores.totalDebt ?? profileStructural.total_debt ?? null;
  const revenue = row.revenue ?? financialScores.revenue ?? profileStructural.revenue ?? null;

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
    strategyState: row.strategy_state ?? row.investment_verdict?.verdict_label ?? null,
    priceEod,
    priceChange,
    ytdReturn,
    marketCap,
    totalDebt,
    revenue,
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

const ValuationSignal = ({ status }: { status: string | null }) => {
  if (!status) return <div className="w-4 h-4" />;

  const lower = status.toLowerCase();
  let bars = 0;

  // 3 barras para 3 estados: Más barras = caro, Menos barras = barato
  if (lower.includes("undervalued") || lower.includes("cheap")) {
    bars = 1;
  } else if (lower.includes("fair")) {
    bars = 2;
  } else if (lower.includes("overvalued") || lower.includes("expensive")) {
    bars = 3;
  }

  return (
    <div className="relative flex items-end gap-[2px] h-4">
      
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-[4px] ${i <= bars ? "bg-[#1E5493]" : "bg-zinc-800"}`}
          style={{ height: `${i * 33.33}%` }}
        />
      ))}
    </div>
  );
};

const IFSRadial = ({ ifs }: { ifs?: EnrichedStockData["ifs"] }) => {
  if (!ifs) {
    // Sin datos: gráfico completo en gris inactivo
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" className="opacity-50">
        <circle cx="12" cy="12" r="10" fill="none" stroke="#3f3f46" strokeWidth="3" />
      </svg>
    );
  }

  const { position, pressure } = ifs;
  
  // Mapeo de position + pressure a nivel de estado (1-5)
  let statusLevel = 0;
  
  if (position === "leader") {
    if (pressure >= 7) statusLevel = 5;
    else if (pressure >= 5) statusLevel = 4;
    else if (pressure >= 3) statusLevel = 3;
    else statusLevel = 2;
  } else if (position === "follower") {
    if (pressure >= 6) statusLevel = 3;
    else if (pressure >= 3) statusLevel = 2;
    else statusLevel = 1;
  } else if (position === "laggard") {
    if (pressure >= 4) statusLevel = 2;
    else statusLevel = 1;
  }

  // Color según nivel - Verde, Amarillo, Rojo
  const getSegmentColor = (segmentIndex: number): string => {
    if (segmentIndex >= statusLevel) return "#27272a"; // zinc-800 vacío
    
    if (statusLevel === 5 || statusLevel === 4) return "#008000"; // Verde
    if (statusLevel === 3) return "#C57D21"; // Amarillo
    return "#800000"; // Rojo fuerte
  };

  // Generar 5 segmentos como arcos (estilo donut)
  const totalSegments = 5;
  const segments = [];
  const cx = 12;
  const cy = 12;
  const r = 8;
  const strokeWidth = 3.5;
  const gapDegrees = 8;
  
  for (let i = 0; i < totalSegments; i++) {
    const segmentDegrees = (360 / totalSegments) - gapDegrees;
    const startAngle = (i * 360 / totalSegments) - 90;
    const endAngle = startAngle + segmentDegrees;
    
    // Convert to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    
    const largeArcFlag = segmentDegrees > 180 ? 1 : 0;
    
    const pathData = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

    segments.push(
      <path
        key={i}
        d={pathData}
        fill="none"
        stroke={getSegmentColor(i)}
        strokeWidth={strokeWidth}
        strokeLinecap="butt"
      />
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ background: 'transparent' }}>
      {segments}
    </svg>
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
  if (score == null) return <span className="text-white">—</span>;

  // Warning if status is not mature/developed or if score is weird
  const showWarning = status === "Incomplete" || status === "Early-stage" || status === "Developing";
  // Actually, "Developing" might be fine. Let's show warning for "Incomplete" or "Pending"
  // User image shows warning for "Developing" sometimes (yellow triangle).
  // Let's assume warning for anything not "Mature" just to match the vibe, or based on specific flag.
  // We'll stick to a simple heuristic: Warning if score exists but status is "Developing" or "Early-stage"? 
  // In the image, "Developing" has warning, "Mature" does not. "Early" does not?
  // Let's rely on `status` itself.
  
  const isWarning = status === "Developing" || status === "Incomplete"; // Heuristic matching image

  // Sentiment Arrow
  let sentimentArrow = null;
  
  if (sentiment === "optimistic") {
    sentimentArrow = (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 3L7 11M7 3L4 6M7 3L10 6" stroke="#0BFD4F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  } else if (sentiment === "pessimistic") {
    sentimentArrow = (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 11L7 3M7 11L10 8M7 11L4 8" stroke="#BE123C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  } else {
    sentimentArrow = (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 7L11 7" stroke="#C57D21" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }

  return (
    <div className="flex items-center justify-between w-full">
      
      {/* Progress Bar - Horizontal, left-aligned, pegado al margen */}
      <div className="h-[24px] bg-zinc-900 overflow-hidden" style={{ width: `${Math.max(12, Math.min(60, score * 0.6))}px` }}>
        <div 
          className="h-full bg-[#26334D]" 
          style={{ width: '100%' }}
        />
      </div>

      {/* Right section: number, arrow, warning */}
      <div className="flex items-center gap-1.5">
        <span className="text-white font-mono text-[13px] w-7 text-right font-light">{score.toFixed(0)}</span>
        <div className="w-3 flex justify-center">
          {isWarning && <AlertTriangle className="w-3 h-3 text-[#FFD700]" />}
        </div>
        {/* Sentiment Arrow */}
        {sentimentArrow}
    
      </div>
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
      className="flex-1 relative p-0 border border-t-0 border-zinc-800 overflow-y-auto bg-[#0A0A0A] rounded-[4px]" // Darker BG
      onScroll={onScroll}
    >
      <table className="w-full text-sm border-collapse">
        <TableHeader className="sticky top-0 z-50 bg-[#1D1D1D]" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
          <TableRow className="bg-[#1D1D1D] border-0">
            <TableHead className="px-3 text-white text-[13px] py-0 h-5 text-left w-[80px] border-r border-black font-light sticky top-0 bg-[#1D1D1D]">Ticker</TableHead>
            <TableHead className="px-1 text-white text-[13px] py-0 h-5 text-center w-[40px] border-r border-black font-light sticky top-0 bg-[#1D1D1D]">R.V</TableHead>
            <TableHead className="px-1 text-white text-[13px] py-0 h-5 text-center w-[50px] border-r border-black font-light sticky top-0 bg-[#1D1D1D]">IFS</TableHead>
            <TableHead className="px-2 text-white text-[13px] py-0 h-5 text-left w-[100px] border-r border-black font-light sticky top-0 bg-[#1D1D1D]">Stage</TableHead>
            <TableHead className="px-2 text-white text-[13px] py-0 h-5 text-right border-r border-black font-light sticky top-0 bg-[#1D1D1D]">FGOS</TableHead>
            <TableHead className="px-2 text-white text-[13px] py-0 h-5 text-right w-[80px] border-r border-black font-light sticky top-0 bg-[#1D1D1D]">EOD</TableHead>
            <TableHead className="px-2 text-white text-[13px] py-0 h-5 text-right w-[80px] border-r border-black font-light sticky top-0 bg-[#1D1D1D]">Mkt Cap</TableHead>
            <TableHead className="px-2 text-white text-[13px] py-0 h-5 text-right w-[80px] border-r border-black font-light sticky top-0 bg-[#1D1D1D]">Total Debt</TableHead>
            <TableHead className="px-2 text-white text-[13px] py-0 h-5 text-right w-[80px] font-light sticky top-0 bg-[#1D1D1D]">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="border-0">
              <TableCell colSpan={9} className="h-24 text-center">
                <div className="flex justify-center items-center gap-2 text-zinc-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos...
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow className="border-0">
              <TableCell colSpan={9} className="text-center text-zinc-500 py-8 text-xs">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((stock) => {
              const isSelected = selectedTicker === stock.ticker;
              return (
                <TableRow
                  key={stock.ticker}
                  className={`hover:bg-zinc-900/50 cursor-pointer transition-colors border-b border-[#1A1A1A] ${
                    isSelected ? "bg-zinc-700 border-l-4 border-l-[#002D72]" : ""
                  }`}
                  onClick={() => onRowClick?.(stock.ticker)}
                >
                  <TableCell className="font-light text-white px-3 py-0 h-5 text-s border-r border-[#484848]">{stock.ticker}</TableCell>

                  <TableCell className="px-1 py-0 h-5 border-r border-[#484848]">
                    <div className="flex justify-center h-full items-center">
                      <ValuationSignal status={stock.sectorValuationStatus} />
                    </div>
                  </TableCell>
                  <TableCell className="px-1 py-0 h-5 border-r border-[#484848]">
                    <div className="flex justify-center h-full items-center">
                      <IFSRadial ifs={stock.ifs} />
                    </div>
                  </TableCell>
                  <TableCell className="text-white py-0 h-5 text-[13px] text-left px-2 border-r border-[#484848] font-light">
                    {stock.fgosStatus || "-"}
                  </TableCell>
                  <TableCell className="py-0 h-5 border-r border-[#484848] pl-0 pr-[2px]">
                    <FGOSCell 
                      score={stock.fgosScore} 
                      status={stock.fgosStatus} 
                      sentiment={stock.sentimentBand} 
                    />
                  </TableCell>
                  <TableCell 
                    className={`text-right px-3 py-0 h-5 text-s font-mono border-r border-[#484848] font-light ${
                      stock.priceChange != null && stock.priceChange > 0 
                        ? 'text-[#34E265]' 
                        : stock.priceChange != null && stock.priceChange < 0 
                        ? 'text-[#BE123C]' 
                        : 'text-zinc-200'
                    }`}
                  >
                    {stock.priceEod != null ? stock.priceEod.toFixed(2) : "-"}
                  </TableCell>
                  <TableCell className="text-right px-3 py-0 h-5 text-s font-mono text-[#EDA64D] font-light border-r border-[#484848]">
                    {stock.marketCap != null ? formatMarketCap(Number(stock.marketCap)) : "-"}
                  </TableCell>
                  <TableCell className="text-right px-3 py-0 h-5 text-s font-mono text-[#EDA64D] font-light border-r border-[#484848]">
                    {stock.totalDebt != null ? formatMarketCap(Number(stock.totalDebt)) : "-"}
                  </TableCell>
                  <TableCell className="text-right px-3 py-0 h-5 text-s font-mono text-[#EDA64D] font-light">
                    {stock.revenue != null ? formatMarketCap(Number(stock.revenue)) : "-"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
          {isFetchingMore && (
            <TableRow className="border-0">
              <TableCell colSpan={9} className="h-10 text-center text-zinc-600 text-xs">
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
