"use client";
// fintra/components/cards/DesempenoCard.tsx

import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getHeatmapColor, HeatmapDirection } from "@/lib/ui/heatmap";

// --- CONSTANTS ---
const CORE_METRICS = [
  "Total Return"
];

// --- TYPES (Same as FundamentalCard/ValoracionCard) ---
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

export default function DesempenoCard({ symbol, scrollRef, peerTicker, highlightedMetrics, defaultExpanded = false }: { symbol: string; scrollRef?: React.RefObject<HTMLDivElement | null>; peerTicker?: string | null; highlightedMetrics?: string[] | null; defaultExpanded?: boolean }) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [peerData, setPeerData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Fetch peer data when selected
  useEffect(() => {
    if (!peerTicker) {
        setPeerData(null);
        return;
    }
    
    let mounted = true;
    const fetchPeer = async () => {
        try {
            const res = await fetch(`/api/analysis/performance-timeline?ticker=${peerTicker}`);
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
      setLoading(true);
      try {
        const res = await fetch(`/api/analysis/performance-timeline?ticker=${symbol}`);
        if (!res.ok) {
            console.error("Failed to fetch performance timeline");
            return;
        }
        const json = await res.json();
        
        if (mounted) {
            setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => { mounted = false; };
  }, [symbol]);

  // Filter for performance metrics
  const performanceMetrics = data?.metrics?.filter(m => m.category === "performance") || [];

  const visibleMetrics = performanceMetrics.filter(metric => {
    if (expanded) return true;
    return CORE_METRICS.includes(metric.label);
  });
  
  // Identify the performance columns (year 9999 or implicit from values)
  // The backend sends a specific year group for performance (usually 9999)
  const perfYearGroup = data?.years?.find(y => y.year === 9999);
  const columns = perfYearGroup?.columns || [];

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
      {/* <div className="px-1 py-1 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Desempeño de <span className="text-[#FFA028]">{symbol}</span>
        </h4>
      </div> */}

		<div
			ref={scrollRef as React.RefObject<HTMLDivElement | null>}
			className="flex-1 p-0 overflow-x-auto overflow-y-hidden scrollbar-on-hover"
		>
			<Table className="min-w-max text-sm border-collapse">
		  	<TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
		  	  <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
		  		<TableHead className="px-2 text-gray-300 text-[10px] h-5 w-[150px] text-left sticky left-0 z-20 bg-[#1D1D1D]">Desempeño</TableHead>
              {columns.flatMap((col, perfYearIndex) => [
                <TableHead 
                  key={col} 
                  className={`px-2 text-gray-300 text-[10px] h-5 text-center whitespace-nowrap ${perfYearIndex % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                >
                  {col}
                </TableHead>,
                peerTicker && (
                    <TableHead
                      key={`${col}-peer`}
                      className={`px-2 text-[#FFFFFF] border-x border-[#002D72] font-bold text-[10px] h-5 text-center whitespace-nowrap ${perfYearIndex % 2 === 0 ? 'bg-[#002D72]' : 'bg-[#002D72]'}`}
                    >
                        {`${peerTicker}_${col}`}
                    </TableHead>
                )
              ])}
            </TableRow>
          </TableHeader>
		  	<TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={100} className="text-center py-8 text-xs text-gray-500">
                   <Loader2 className="w-4 h-4 animate-spin inline mr-2"/> Cargando desempeño...
                 </TableCell>
               </TableRow>
            ) : performanceMetrics.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={100} className="text-center py-8 text-xs text-gray-500">
                        -
                    </TableCell>
                </TableRow>
            ) : (
              performanceMetrics.map((metric) => {
                const isHighlighted = highlightedMetrics?.includes(metric.label);
                return (
                  <TableRow 
                    key={metric.key} 
                    className={`border-zinc-800 border-b transition-all duration-300 ${isHighlighted ? 'bg-[#FFA028]/10 border-l-2 border-l-[#FFA028] shadow-[inset_0_0_20px_rgba(255,160,40,0.05)]' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                  >
			  	<TableCell className="font-bold text-gray-200 px-2 py-0 text-[10px] h-6 w-[120px] border-r border-zinc-800 sticky left-0 z-10 bg-[#0A0A0A]">
                    {metric.label}
                  </TableCell>
                  {columns.flatMap((col, perfYearIndex) => {
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
                              className={`text-center px-2 py-0 text-[10px] font-medium text-white h-6 border-x border-zinc-800/50 ${perfYearIndex % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                              style={{ backgroundColor: getHeatmapColor(cellData?.normalized ?? null, direction) }}
                          >
                              {cellData?.display ?? "-"}
                          </TableCell>,
                          peerTicker && (
                              <TableCell 
                                  key={`${col}-peer`}
                                  className={`text-center px-2 py-0 text-[10px] font-bold text-[#FFFFFF] h-6 border-x border-[#002D72] ${perfYearIndex % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                                  style={{ backgroundColor: getHeatmapColor(peerCellData?.normalized ?? null, direction) }}
                              >
                                  {peerCellData?.display ?? "-"}
                              </TableCell>
                          )
                      ];
                  })}
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
