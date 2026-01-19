"use client";
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatMarketCap } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Shared interface
export interface EnrichedStockData {
  ticker: string;
  sectorRank: number | null;
  sectorRankTotal: number | null;
  sectorValuationStatus: string | null;
  fgosBand: string | null;
  competitiveStructureBand: string | null;
  relativeResultBand: string | null;
  strategyState: string | null;
  priceEod: number | null;
  ytdReturn: number | null;
  marketCap: number | null;
}

// Helper Constants & Functions
const FGOS_BAND_ORDER: Record<string, number> = {
  strong: 1,
  defendable: 2,
  weak: 3,
};

const RELATIVE_RESULT_ORDER: Record<string, number> = {
  outperformer: 1,
  neutral: 2,
  underperformer: 3,
};

const VALUATION_ORDER: Record<string, number> = {
  undervalued: 1,
  fairly_valued: 2,
  overvalued: 3,
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

  const csA = getOrderValue(a.competitiveStructureBand, FGOS_BAND_ORDER);
  const csB = getOrderValue(b.competitiveStructureBand, FGOS_BAND_ORDER);
  if (csA !== csB) return csA - csB;

  const rrA = getOrderValue(a.relativeResultBand, RELATIVE_RESULT_ORDER);
  const rrB = getOrderValue(b.relativeResultBand, RELATIVE_RESULT_ORDER);
  if (rrA !== rrB) return rrA - rrB;

  const valA = getOrderValue(a.sectorValuationStatus, VALUATION_ORDER);
  const valB = getOrderValue(b.sectorValuationStatus, VALUATION_ORDER);
  if (valA !== valB) return valA - valB;

  return a.ticker.localeCompare(b.ticker);
};

const formatFgosBand = (band: string | null) => {
  if (!band) return "—";
  const lower = band.toLowerCase();
  if (lower === "strong") return "Fuerte";
  if (lower === "defendable") return "Defendible";
  if (lower === "weak") return "Débil";
  return band;
};

const formatRelativeResult = (band: string | null) => {
  if (!band) return "—";
  const lower = band.toLowerCase();
  if (lower === "outperformer") return "Supera al benchmark";
  if (lower === "neutral") return "En línea con el benchmark";
  if (lower === "underperformer") return "Por debajo del benchmark";
  return band;
};

const formatStrategyState = (state: string | null) => {
  if (!state) return "—";
  return state.charAt(0).toUpperCase() + state.slice(1);
};

const ValuationStatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <span className="text-gray-500 text-[10px]">—</span>;

  const lower = status.toLowerCase();
  let label = status;
  if (lower === "undervalued" || lower === "cheap_sector") label = "Barata vs sector";
  else if (lower === "fairly_valued" || lower === "fair_sector") label = "En línea vs sector";
  else if (lower === "overvalued" || lower === "expensive_sector") label = "Cara vs sector";

  return (
    <Badge
      className="px-2 py-0.5 text-[9px] h-5 justify-center whitespace-nowrap bg-zinc-900/60 border-zinc-600 text-zinc-200"
      variant="outline"
    >
      {label}
    </Badge>
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
  return (
    <div
      ref={scrollRef}
      className="flex-1 relative p-0 border border-t-0 border-zinc-800 overflow-y-auto"
      onScroll={onScroll}
    >
      <table className="w-full text-sm">
        <TableHeader className="sticky top-0 z-10 bg-[#1D1D1D]">
          <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[60px]">Ticker</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Ranking Sectorial (IFS)</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[120px]">Valuación Relativa al Sector</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Calidad Fundamental</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Estructura Competitiva</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Resultado Relativo</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center w-[100px]">Estado Estratégico</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Precio EOD</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[60px]">YTD %</TableHead>
            <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-right w-[70px]">Mkt Cap</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow className="border-zinc-800">
              <TableCell colSpan={10} className="h-24 text-center">
                <div className="flex justify-center items-center gap-2 text-gray-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos...
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow className="border-zinc-800">
              <TableCell colSpan={10} className="text-center text-gray-500 py-8 text-xs">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((stock) => {
              const isSelected = selectedTicker === stock.ticker;
              return (
                <TableRow
                  key={stock.ticker}
                  className={`border-zinc-800 hover:bg-white/5 cursor-pointer transition-colors ${
                    isSelected ? "border-2 border-[#002D72]" : ""
                  }`}
                  onClick={() => onRowClick?.(stock.ticker)}
                >
                  <TableCell className="font-bold text-white px-2 py-0.5 text-xs">{stock.ticker}</TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-200 font-mono">
                    {stock.sectorRank != null
                      ? stock.sectorRankTotal != null
                        ? `#${stock.sectorRank} / ${stock.sectorRankTotal}`
                        : `#${stock.sectorRank}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5">
                    <ValuationStatusBadge status={stock.sectorValuationStatus} />
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatFgosBand(stock.fgosBand)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatFgosBand(stock.competitiveStructureBand)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatRelativeResult(stock.relativeResultBand)}
                  </TableCell>
                  <TableCell className="text-center px-2 py-0.5 text-[10px] text-gray-300">
                    {formatStrategyState(stock.strategyState)}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-xs font-mono text-white">
                    {stock.priceEod != null ? `$${Number(stock.priceEod).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell
                    className="text-center px-2 py-0.5 text-[10px] font-medium text-gray-300"
                  >
                    {stock.ytdReturn != null
                      ? `${stock.ytdReturn >= 0 ? "+" : ""}${Number(stock.ytdReturn).toFixed(1)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right px-2 py-0.5 text-[10px] text-gray-400">
                    {stock.marketCap != null ? formatMarketCap(Number(stock.marketCap)) : "—"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
          {isFetchingMore && (
            <TableRow className="border-zinc-800">
              <TableCell colSpan={10} className="h-12 text-center text-gray-400 text-xs">
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
