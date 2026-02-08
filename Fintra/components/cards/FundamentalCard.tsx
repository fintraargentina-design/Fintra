"use client";
// fintra/components/cards/FundamentalCard.tsx

import React, { useState, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FinancialHistory } from "@/lib/services/ticker-view.service";

// --- METRICS DEFINITION ---
const METRICS_CONFIG = [
  { label: "Gross Margin", key: "gross_margin", format: (v: number) => `${v?.toFixed(2)}%` },
  { label: "Operating Margin", key: "operating_margin", format: (v: number) => `${v?.toFixed(2)}%` },
  { label: "Net Margin", key: "net_margin", format: (v: number) => `${v?.toFixed(2)}%` },
  { label: "ROE", key: "roe", format: (v: number) => `${v?.toFixed(2)}%` },
  { label: "ROIC", key: "roic", format: (v: number) => `${v?.toFixed(2)}%` },
  { label: "Total Debt", key: "total_debt", format: (v: number) => formatLargeNumber(v) },
  { label: "Debt/Equity", key: "debt_to_equity", format: (v: number) => v?.toFixed(2) },
  { label: "Current Ratio", key: "current_ratio", format: (v: number) => v?.toFixed(2) },
  { label: "Interest Coverage", key: "interest_coverage", format: (v: number) => v?.toFixed(2) },
  { label: "Revenue", key: "revenue", format: (v: number) => formatLargeNumber(v) },
  { label: "Net Income", key: "net_income", format: (v: number) => formatLargeNumber(v) },
  { label: "Free Cash Flow", key: "free_cash_flow", format: (v: number) => formatLargeNumber(v) },
  { label: "EBITDA", key: "ebitda", format: (v: number) => formatLargeNumber(v) },
  { label: "Rev. CAGR", key: "revenue_cagr", format: (v: number) => `${v?.toFixed(2)}%` },
];

function formatLargeNumber(num: number): string {
  if (num === null || num === undefined) return "-";
  if (Math.abs(num) >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`;
  }
  if (Math.abs(num) >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`;
  }
  return `$${num.toLocaleString()}`;
}

export interface FundamentalCardProps {
  symbol: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  peerTicker?: string | null;
  defaultExpanded?: boolean;
  hideExpandButton?: boolean;
  data?: FinancialHistory[];
  peerData?: FinancialHistory[];
  // Legacy props (ignored but kept for type compatibility if needed)
  highlightedMetrics?: string[] | null;
  timelineData?: any;
}

export default function FundamentalCard({ 
  symbol, 
  scrollRef, 
  peerTicker, 
  defaultExpanded = false,
  hideExpandButton = false,
  data = [],
  peerData = []
}: FundamentalCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const localRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = scrollRef || localRef;

  // Scroll to right on load
  useEffect(() => {
    if (data.length > 0 && scrollContainerRef.current) {
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
            }
        }, 0);
    }
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex flex-col bg-tarjetas border border-zinc-800 rounded p-4 items-center justify-center">
        <span className="text-zinc-500 text-sm">S/D</span>
      </div>
    );
  }

  // Sort periods
  const periods = [...data].sort((a, b) => new Date(a.period_end_date).getTime() - new Date(b.period_end_date).getTime());

  // Helper to find peer value for the same period
  const getPeerValue = (periodLabel: string, key: string) => {
    if (!peerData) return null;
    const peerPeriod = peerData.find(p => p.period_label === periodLabel);
    return peerPeriod ? (peerPeriod as any)[key] : null;
  };

  const visibleMetrics = expanded ? METRICS_CONFIG : METRICS_CONFIG.slice(0, 5); // Show first 5 if collapsed

  return (
    <div className="w-full h-full flex flex-col bg-tarjetas overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
      >
        <Table className="min-w-max text-sm border-collapse">
          <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
            <TableRow className="bg-[#1D1D1D] hover:bg-[#1D1D1D] border-b-0">
              <TableHead className="px-2 text-gray-300 text-[10px] h-5 w-[120px] font-light font-nano text-left sticky left-0 z-20 bg-[#1D1D1D] border-r border-zinc-800">
                Fundamentales
              </TableHead>
              {periods.map((period, idx) => (
                <React.Fragment key={period.period_label}>
                  <TableHead className={`px-2 text-gray-300 text-[10px] h-5 text-center whitespace-nowrap ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}>
                    {period.period_label}
                  </TableHead>
                  {peerTicker && (
                    <TableHead className={`px-2 text-[#ffffff] font-bold text-[10px] h-5 text-center whitespace-nowrap border-l border-[#002D72] ${idx % 2 === 0 ? 'bg-[#002D72]' : 'bg-[#002D72]'}`}>
                      {peerTicker}
                    </TableHead>
                  )}
                </React.Fragment>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleMetrics.map((metric) => (
              <TableRow key={metric.key} className="hover:bg-white/5 border-b border-zinc-800 last:border-0">
                <TableCell className="font-light text-gray-200 px-2 py-1 text-[10px] h-6 w-[120px] sticky left-0 z-10 bg-[#1D1D1D] border-r border-zinc-800">
                  {metric.label}
                </TableCell>
                {periods.map((period, idx) => {
                  const val = (period as any)[metric.key];
                  const peerVal = getPeerValue(period.period_label, metric.key);
                  
                  return (
                    <React.Fragment key={`${metric.key}-${period.period_label}`}>
                      <TableCell className={`text-center px-2 py-1 text-[10px] font-medium text-white h-6 ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}>
                        {val !== null && val !== undefined ? metric.format(val) : "-"}
                      </TableCell>
                      {peerTicker && (
                        <TableCell className={`text-center px-2 py-1 text-[10px] font-bold text-white h-6 border-l border-[#002D72] ${idx % 2 === 0 ? 'bg-[#002D72]/50' : 'bg-[#002D72]/50'}`}>
                          {peerVal !== null && peerVal !== undefined ? metric.format(peerVal) : "-"}
                        </TableCell>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {!hideExpandButton && (
        <div className="bg-transparent border-t border-zinc-800 p-1 flex justify-center shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors uppercase tracking-wider font-medium"
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" /> Menos</>
            ) : (
              <>Ver más <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
