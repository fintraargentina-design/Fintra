"use client";

import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { getHeatmapColor, HeatmapDirection } from "@/lib/ui/heatmap";

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
    priority: "A" | "B";
    heatmap: {
      direction: "higher_is_better" | "lower_is_better";
      scale: "relative_row";
    };
    values: {
      [periodLabel: string]: {
        value: number | null;
        display: string | null;
        normalized: number | null;
        period_type: "FY" | null;
        period_end_date?: string;
      };
    };
  }[];
};

export interface DividendosTableCardProps {
  symbol: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  peerTicker?: string | null;
  highlightedMetrics?: string[] | null;
}

export default function DividendosTableCard({ 
  symbol, 
  scrollRef, 
  peerTicker, 
  highlightedMetrics 
}: DividendosTableCardProps) {
  const [internalData, setInternalData] = useState<TimelineResponse | null>(null);
  const [peerData, setPeerData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true); // Default to expanded since few metrics

  // Fetch peer data when selected
  useEffect(() => {
    if (!peerTicker) {
        setPeerData(null);
        return;
    }
    
    let mounted = true;
    const fetchPeer = async () => {
        try {
            const res = await fetch(`/api/analysis/dividends-timeline?ticker=${peerTicker}`);
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

  // Fetch main data
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/analysis/dividends-timeline?ticker=${symbol}`);
        if (!res.ok) {
            console.error("Failed to fetch dividends timeline");
            return;
        }
        const json = await res.json();
        
        if (mounted) {
            setInternalData(json);
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

  // Use internal data
  const data = internalData;

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
      <div className="px-1 py-1 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Histórico de Dividendos de <span className="text-[#FFA028]">{symbol}</span>
        </h4>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-0 scrollbar-thin">
        <Table className="w-full text-sm border-collapse">
          <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
            <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[150px] text-left">Métrica</TableHead>
              {data?.years.map((year, yearIdx) => (
                year.columns.map(col => (
                    <TableHead key={col} className={`px-2 text-gray-300 text-[10px] h-6 text-center whitespace-nowrap ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}>
                        {col.replace('_FY', '')}
                    </TableHead>
                ))
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               <TableRow>
                 <TableCell colSpan={100} className="text-center py-8 text-xs text-gray-500">
                   <Loader2 className="w-4 h-4 animate-spin inline mr-2"/> Cargando dividendos...
                 </TableCell>
               </TableRow>
            ) : (
              data?.metrics.map((metric) => {
                const isHighlighted = highlightedMetrics?.includes(metric.label);
                return (
                  <TableRow 
                    key={metric.key} 
                    className={`border-zinc-800 border-b transition-all duration-300 ${isHighlighted ? 'bg-[#FFA028]/10 border-l-2 border-l-[#FFA028] shadow-[inset_0_0_20px_rgba(255,160,40,0.05)]' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                  >
                  <TableCell className="font-bold text-gray-200 px-2 py-0.5 text-xs w-[100px] border-r border-zinc-800">
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
    </div>
  );
}
