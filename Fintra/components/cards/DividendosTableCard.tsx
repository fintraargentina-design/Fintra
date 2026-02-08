"use client";
// fintra/components/cards/DividendosTableCard.tsx

import React, { useMemo, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DividendHistory } from "@/lib/services/ticker-view.service";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export interface DividendosTableCardProps {
  symbol: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  peerTicker?: string | null;
  highlightedMetrics?: string[] | null;
  defaultExpanded?: boolean;
  data?: DividendHistory[];
  peerData?: DividendHistory[];
}

export default function DividendosTableCard({ 
  symbol, 
  scrollRef, 
  peerTicker, 
  highlightedMetrics,
  defaultExpanded = true,
  data,
  peerData
}: DividendosTableCardProps) {
  
  const localRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = scrollRef || localRef;

  // Scroll to end on load
  useEffect(() => {
    if (data && data.length > 0 && scrollContainerRef.current) {
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
            }
        }, 0);
    }
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-tarjetas border border-zinc-800 rounded p-4 items-center justify-center min-h-[200px]">
        <span className="text-zinc-500 text-sm">S/D</span>
      </div>
    );
  }

  // Sort by year
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.year - b.year);
  }, [data]);

  // Peer map
  const peerMap = useMemo(() => {
    if (!peerData) return new Map<number, DividendHistory>();
    const map = new Map<number, DividendHistory>();
    peerData.forEach(p => map.set(p.year, p));
    return map;
  }, [peerData]);

  // Helper formats
  const formatCurrency = (val: number | undefined) => val !== undefined ? `$${val.toFixed(2)}` : "-";
  const formatPercent = (val: number | undefined) => val !== undefined ? `${val.toFixed(2)}%` : "-";
  const formatBool = (val: boolean | undefined) => {
      if (val === undefined) return "-";
      return val ? <Check className="w-4 h-4 text-green-500 mx-auto" /> : <X className="w-4 h-4 text-red-500 mx-auto" />;
  };

  const METRICS = [
    { label: "Dividend per Share", key: "dividend_per_share", format: formatCurrency },
    { label: "Dividend Yield", key: "dividend_yield", format: formatPercent },
    { label: "Payout Ratio (EPS)", key: "payout_eps", format: formatPercent },
    { label: "Payout Ratio (FCF)", key: "payout_fcf", format: formatPercent },
    { label: "Has Dividend", key: "has_dividend", format: formatBool },
    { label: "Stable", key: "is_stable", format: formatBool },
    { label: "Growing", key: "is_growing", format: formatBool },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
		<div
			ref={scrollContainerRef}
			className="flex-1 p-0 overflow-x-auto overflow-y-hidden scrollbar-on-hover"
		>
			<Table className="min-w-max text-sm border-collapse">
			<TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
			  <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
				<TableHead className="px-2 text-gray-300 text-[10px] h-5 w-[150px] font-light font-nano text-left sticky left-0 z-20 bg-[#1D1D1D]">Dividendos</TableHead>
				      {sortedData.map((item, idx) => (
                          <React.Fragment key={item.year}>
                            <TableHead
                                className={`px-2 text-gray-300 text-[10px] h-5 text-center whitespace-nowrap ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                            >
                                {item.year}
                            </TableHead>
                            {peerTicker && (
                                <TableHead
                                    className={`px-2 text-[#FFFFFF] font-bold text-[10px] h-5 text-center whitespace-nowrap ${idx % 2 === 0 ? 'bg-[#002D72]' : 'bg-[#002D72]'}`}
                                >
                                    {peerTicker}_{item.year}
                                </TableHead>
                            )}
                          </React.Fragment>
				      ))}
				</TableRow>
			  </TableHeader>
			<TableBody>
              {METRICS.map((metric) => {
                const isHighlighted = highlightedMetrics?.includes(metric.label);
                return (
                  <TableRow 
                    key={metric.key} 
                    className={`border-zinc-800 border-b transition-all duration-300 ${isHighlighted ? 'bg-[#FFA028]/10 border-l-2 border-l-[#FFA028] shadow-[inset_0_0_20px_rgba(255,160,40,0.05)]' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                  >
			  	<TableCell className="font-bold text-gray-200 px-2 py-0 text-[10px] h-6 w-[100px] border-r border-zinc-800 sticky left-0 z-10 bg-[#0A0A0A]">
                    {metric.label}
                  </TableCell>
                  {sortedData.map((item, idx) => {
                      const val = item[metric.key as keyof DividendHistory];
                      const peerItem = peerMap.get(item.year);
                      const peerVal = peerItem ? peerItem[metric.key as keyof DividendHistory] : undefined;
                      
                      return (
                        <React.Fragment key={item.year}>
                            <TableCell 
                                className={`text-center px-2 py-0 text-[10px] font-medium text-white h-6 border-x border-zinc-800/50 ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                            >
                                {/* @ts-ignore */}
                                {metric.format(val)}
                            </TableCell>
                            {peerTicker && (
                                <TableCell 
                                    className={`text-center px-2 py-0 text-[10px] font-bold text-[#FFFFFF] h-6 border-x border-[#002D72] ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                                >
                                    {/* @ts-ignore */}
                                    {peerItem ? metric.format(peerVal) : "-"}
                                </TableCell>
                            )}
                        </React.Fragment>
                      );
                  })}
                </TableRow>
                );
              })}
          </TableBody>
			</Table>
		  </div>
    </div>
  );
}
