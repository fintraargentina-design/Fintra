"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getHeatmapColor, HeatmapDirection } from "@/lib/ui/heatmap";

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

export default function DesempenoCard({ symbol, scrollRef }: { symbol: string; scrollRef?: React.RefObject<HTMLDivElement> }) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analysis/fundamentals-timeline?ticker=${symbol}`);
        if (!res.ok) {
            console.error("Failed to fetch fundamentals timeline");
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
  
  // Identify the performance columns (year 9999 or implicit from values)
  // The backend sends a specific year group for performance (usually 9999)
  const perfYearGroup = data?.years?.find(y => y.year === 9999);
  const columns = perfYearGroup?.columns || [];

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
      <div className="px-1 py-1 bg-white/[0.02] shrink-0">
        <h4 className="text-xs font-medium text-gray-400 text-center">
          Desempeño de <span className="text-[#FFA028]">{symbol}</span>
        </h4>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-0 scrollbar-thin">
        <Table className="w-full text-sm border-collapse">
          <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
            <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
              <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[120px] text-left">Desempeño</TableHead>
              {columns.map(col => (
                <TableHead 
                  key={col} 
                  className="px-2 text-gray-300 text-[10px] h-6 text-center whitespace-nowrap"
                >
                  {col}
                </TableHead>
              ))}
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
              performanceMetrics.map((metric) => (
                <TableRow 
                  key={metric.key} 
                  className="border-zinc-800 hover:bg-white/5 border-b"
                >
                  <TableCell className="font-bold text-gray-200 px-2 py-0.5 text-xs w-[120px] border-r border-zinc-800">
                    {metric.label}
                  </TableCell>
                  {columns.map(col => {
                      const cellData = metric.values[col];
                      const direction: HeatmapDirection = metric.heatmap.direction === "lower_is_better" 
                            ? "negative" 
                            : "positive";
                      return (
                          <TableCell 
                              key={col}
                              className="text-center px-2 py-0.5 text-[10px] font-medium text-white h-8 border-x border-zinc-800/50"
                              style={{ backgroundColor: getHeatmapColor(cellData?.normalized ?? null, direction) }}
                          >
                              {cellData?.display ?? "-"}
                          </TableCell>
                      );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
