"use client";
// fintra/components/cards/FundamentalCard.tsx

import React, { useEffect, useState, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FintraLoader } from "@/components/ui/FintraLoader";
import { getHeatmapColor, HeatmapDirection } from "@/lib/ui/heatmap";

// --- CONSTANTS ---
const CORE_METRICS = [
  "ROIC", 
  "ROE", 
  "Margen neto", 
  "FCF Margin", 
  "Crecimiento Ventas", 
  "Crecimiento Beneficio"
];

// --- TYPES ---
type TimelineResponse = {
  ticker: string;
  currency: string;
  years: {
    year: number;
    tone: "light" | "dark";
    columns: string[];
  }[];
  metrics: {
    key: string;
    label: string;
    unit: string;
    category: string;
    priority: "A" | "B" | "C";
    heatmap: {
      direction: "higher_is_better" | "lower_is_better";
      scale: "relative_row";
    };
    values: {
      [periodLabel: string]: {
        value: number | null;
        display: string | null;
        normalized: number | null;
        period_type: "Q" | "TTM" | "FY" | null;
        period_end_date?: string;
      };
    };
  }[];
};

export interface FundamentalCardProps {
  symbol: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  peerTicker?: string | null;
  highlightedMetrics?: string[] | null;
  timelineData?: TimelineResponse | null;
  defaultExpanded?: boolean;
  hideExpandButton?: boolean;
}

export default function FundamentalCard({ 
  symbol, 
  scrollRef, 
  peerTicker, 
  highlightedMetrics,
  timelineData,
  defaultExpanded = false,
  hideExpandButton = false
}: FundamentalCardProps) {
  const [internalData, setInternalData] = useState<TimelineResponse | null>(null);
  const [peerData, setPeerData] = useState<TimelineResponse | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isControlled = timelineData !== undefined;
  const data = isControlled ? timelineData : internalData;
  const loading = isControlled ? !data : internalLoading;

  const years = data?.years ?? [];
  const sortedYears = React.useMemo(() => {
    return [...years].sort((a, b) => Number(a.year) - Number(b.year));
  }, [years]);

  const localRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = scrollRef || localRef;

  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
        // Small timeout to ensure rendering is complete
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
            }
        }, 0);
    }
  }, [loading, sortedYears]);

  // Fetch peer data when selected
  useEffect(() => {
    if (!peerTicker) {
        setPeerData(null);
        return;
    }
    
    let mounted = true;
    const fetchPeer = async () => {
        try {
            const res = await fetch(`/api/analysis/fundamentals-timeline?ticker=${peerTicker}`);
            if (res.ok) {
                const json = await res.json();
                if (mounted) setPeerData(json);
            }
        } catch (e) {
            console.error(e);
        }
    };
    
    fetchPeer();
    return () => { mounted = false; };
  }, [peerTicker]);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      if (isControlled) return;

      setInternalLoading(true);
      try {
        const res = await fetch(`/api/analysis/fundamentals-timeline?ticker=${symbol}`);
        if (!res.ok) {
            // Silently fail or log? The existing code logged error.
            console.error("Failed to fetch fundamentals timeline");
            return;
        }
        const json = await res.json();
        
        if (mounted) {
            setInternalData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setInternalLoading(false);
      }
    };
    
    fetchData();
    return () => { mounted = false; };
  }, [symbol, isControlled]);

  // Filter metrics based on expanded state
  const visibleMetrics = data?.metrics?.filter(metric => {
    if (expanded) return true;
    return CORE_METRICS.includes(metric.label);
  }) || [];

  return (
		<div className="w-full h-full flex flex-col bg-tarjetas overflow-hidden">
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-x-auto overflow-y-hidden"
			>
		<Table className="min-w-max text-sm ">
          <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
            <TableRow className=" hover:bg-[#1D1D1D] bg-[#1D1D1D] ">
              <TableHead className="border-2 border-zinc-800 px-0 text-gray-300 text-[10px] h-5 w-[150px] font-light font-nano text-left  left-0 z-20 bg-[#1D1D1D]">Fundamentales</TableHead>
              {sortedYears.map((year, yearIdx) => (
                year.columns.flatMap(col => [
                  <TableHead
                    key={col}
                    className={`border-2 border-zinc-800 px-2 text-gray-300 text-[10px] h-5 text-center whitespace-nowrap ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                  >
                    {col}
                  </TableHead>,
                  peerTicker && (
                    <TableHead
                      key={`${col}-peer`}
                      className={`border-2 border-zinc-800 px-0 text-[#ffffff]  font-bold text-[10px] h-5 text-center whitespace-nowrap ${yearIdx % 2 === 0 ? 'bg-[#002D72]' : 'bg-[#002D72]'}`}
                    >
                      {`${peerTicker}_${col}`}
                    </TableHead>
                  ),
                ])
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={100} className="text-center py-8 text-xs text-gray-500">
                   <FintraLoader size={16} className="mr-2 inline-block align-middle"/> <span className="align-middle">Cargando fundamentales...</span>
                 </TableCell>
               </TableRow>
            ) : (
              visibleMetrics.map((metric) => {
                const isHighlighted = highlightedMetrics?.includes(metric.label);
                return (
                  <TableRow 
                    key={metric.key} 
                    className={`transition-all duration-300 ${isHighlighted ? 'bg-[#FFA028]/10 border-l-2 border-l-[#FFA028] ' : 'hover:bg-white/5 '}`}
                  >
                  <TableCell className="font-light text-gray-200 px-0 py-0 text-[10px] h-6 w-[100px] sticky left-0 z-10 bg-[#1D1D1D]">
                    {metric.label}
                  </TableCell>
                  {sortedYears.map((year, yearIdx) => (
                    year.columns.flatMap(col => {
                        const cellData = metric.values[col];
                        const direction: HeatmapDirection = metric.heatmap.direction === "lower_is_better" 
                            ? "negative" 
                            : "positive";
                            
                        // Peer Data
                        const peerMetric = peerData?.metrics?.find(m => m.key === metric.key);
                        const peerCellData = peerMetric?.values?.[col];

                        return [
                            <TableCell 
                                key={col}
                                className={`text-center px-0 py-0 text-[10px] font-medium text-white h-6 border-x border-zinc-800/50 ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                                style={{ backgroundColor: getHeatmapColor(cellData?.normalized ?? null, direction) }}
                            >
                                {cellData?.display ?? "-"}
                            </TableCell>,
                            peerTicker && (
                                <TableCell 
                                    key={`${col}-peer`}
                                    className={`text-center px-2 py-0 text-[10px] font-bold text-[#FFFFFF] h-6 border-x border-[#002D72] ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                                    style={{ backgroundColor: getHeatmapColor(peerCellData?.normalized ?? null, direction) }}
                                >
                                    {peerCellData?.display ?? "-"}
                                </TableCell>
                            )
                        ];
                    })
                  ))}
                </TableRow>
                );
              })
            )}
          </TableBody>
			</Table>
		  </div>     
    </div>
  );
}
