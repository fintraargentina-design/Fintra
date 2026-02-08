"use client";
// fintra/components/cards/DesempenoCard.tsx

import { PerformanceHistory } from "@/lib/services/ticker-view.service";
import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DesempenoCardProps {
  symbol: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  peerTicker?: string | null;
  defaultExpanded?: boolean;
  data?: PerformanceHistory[];
  peerData?: PerformanceHistory[];
  // Legacy props
  highlightedMetrics?: string[] | null;
}

export default function DesempenoCard({
  symbol,
  scrollRef,
  peerTicker,
  defaultExpanded = false,
  data,
  peerData,
}: DesempenoCardProps) {
  // If no data, show S/D
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-tarjetas border border-zinc-800 rounded p-4 items-center justify-center min-h-[200px]">
        <span className="text-zinc-500 text-sm">S/D</span>
      </div>
    );
  }

  // Helper to format percentage with color
  const formatPercent = (val: number | undefined | null) => {
    if (val === undefined || val === null) return "S/D";
    const colorClass = val > 0 ? "text-green-500" : val < 0 ? "text-red-500" : "text-zinc-300";
    return <span className={colorClass}>{val.toFixed(2)}%</span>;
  };

  // Helper to format currency/absolute return
  const formatCurrency = (val: number | undefined | null) => {
     if (val === undefined || val === null) return "S/D";
     const colorClass = val > 0 ? "text-green-500" : val < 0 ? "text-red-500" : "text-zinc-300";
     return <span className={colorClass}>${val.toFixed(2)}</span>;
  };

  // Sort windows in logical order
  const windowOrder = ["1M", "3M", "6M", "YTD", "1Y", "3Y", "5Y", "10Y"];
  
  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
        const idxA = windowOrder.indexOf(a.window_code);
        const idxB = windowOrder.indexOf(b.window_code);
        // Put unknown windows at the end
        const valA = idxA === -1 ? 999 : idxA;
        const valB = idxB === -1 ? 999 : idxB;
        return valA - valB;
    });
  }, [data]);

  // Create a map for peer data for easy lookup by window_code
  const peerMap = useMemo(() => {
    if (!peerData) return new Map<string, PerformanceHistory>();
    const map = new Map<string, PerformanceHistory>();
    peerData.forEach(p => map.set(p.window_code, p));
    return map;
  }, [peerData]);

  return (
    <div 
      ref={scrollRef}
      className="w-full flex flex-col bg-tarjetas border border-zinc-800 rounded overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <h3 className="font-semibold text-zinc-100">Rendimiento</h3>
      </div>
      
      <div className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-zinc-800">
              <TableHead className="w-[100px] text-zinc-400">Periodo</TableHead>
              <TableHead className="text-right text-zinc-400">Retorno %</TableHead>
              <TableHead className="text-right text-zinc-400">Retorno Abs.</TableHead>
              {peerTicker && (
                 <TableHead className="text-right text-zinc-400 border-l border-zinc-800">
                    {peerTicker} %
                 </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((item) => {
                const peerItem = peerMap.get(item.window_code);
                
                return (
                    <TableRow key={item.window_code} className="hover:bg-zinc-800/50 border-zinc-800">
                        <TableCell className="font-medium text-zinc-200">
                            {item.window_code}
                        </TableCell>
                        <TableCell className="text-right">
                            {formatPercent(item.return_percent)}
                        </TableCell>
                         <TableCell className="text-right">
                            {formatCurrency(item.absolute_return)}
                        </TableCell>
                        {peerTicker && (
                            <TableCell className="text-right border-l border-zinc-800">
                                {peerItem ? formatPercent(peerItem.return_percent) : <span className="text-zinc-600">-</span>}
                            </TableCell>
                        )}
                    </TableRow>
                );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
