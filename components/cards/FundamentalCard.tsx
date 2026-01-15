"use client";
// fintra/components/cards/FundamentalCard.tsx

import React, { useEffect, useState, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
}

export default function FundamentalCard({ 
  symbol, 
  scrollRef, 
  peerTicker, 
  highlightedMetrics,
  timelineData 
}: FundamentalCardProps) {
  const [internalData, setInternalData] = useState<TimelineResponse | null>(null);
  const [peerData, setPeerData] = useState<TimelineResponse | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const isControlled = timelineData !== undefined;
  const data = isControlled ? timelineData : internalData;
  const loading = isControlled ? !data : internalLoading;

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
  }, [loading]);

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
		<div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
      {/* <div className="px-1 py-1 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Fundamentales de <span className="text-[#FFA028]">{symbol}</span>
        </h4>
      </div> */}

			<div
				ref={scrollContainerRef}
				className="flex-1 p-0 overflow-x-auto overflow-y-hidden"
			>
		<Table className="min-w-max text-sm border-collapse">
          <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10 border-2 border-zinc-800">
            <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
              <TableHead className="px-2 text-gray-300 text-[12px] h-6 w-[150px] font-light font-nano text-left sticky left-0 z-20 bg-[#1D1D1D]">Fundamentales</TableHead>
              {data?.years.map((year, yearIdx) => (
                year.columns.map(col => (
                    <TableHead key={col} className={`px-2 text-gray-300 text-[10px] h-6 text-center whitespace-nowrap ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}>
                        {col}
                    </TableHead>
                ))
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={100} className="text-center py-8 text-xs text-gray-500">
                   <Loader2 className="w-4 h-4 animate-spin inline mr-2"/> Cargando fundamentales...
                 </TableCell>
               </TableRow>
            ) : (
              visibleMetrics.map((metric) => {
                const isHighlighted = highlightedMetrics?.includes(metric.label);
                return (
                  <TableRow 
                    key={metric.key} 
                    className={`border-zinc-800 border-b transition-all duration-300 ${isHighlighted ? 'bg-[#FFA028]/10 border-l-2 border-l-[#FFA028] shadow-[inset_0_0_20px_rgba(255,160,40,0.05)]' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                  >
                  <TableCell className="font-bold text-gray-200 px-2 py-0.5 text-xs w-[100px] border border-zinc-800 sticky left-0 z-10 bg-[#1D1D1D]">
                    {metric.label}
                  </TableCell>
                  {data?.years?.map((year, yearIdx) => (
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
                                className={`text-center px-2 py-0.5 text-[10px] font-medium text-white h-8 border-x border-zinc-800/50 ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                                style={{ backgroundColor: getHeatmapColor(cellData?.normalized ?? null, direction) }}
                            >
                                {cellData?.display ?? "-"}
                            </TableCell>,
                            peerTicker && (
                                <TableCell 
                                    key={`${col}-peer`}
                                    className={`text-center px-2 py-0.5 text-[10px] font-bold text-[#0056FF] h-8 border-x border-zinc-800/50 ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
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
      
      {/* Toggle Button */}
      <div className="bg-transparent border-t-0 border-zinc-800 p-1 flex justify-center shrink-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors uppercase tracking-wider font-medium"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Ver más Fundamentales <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
