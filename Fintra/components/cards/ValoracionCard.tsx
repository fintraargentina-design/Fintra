"use client";
// fintra/components/cards/ValoracionCard.tsx

import React, { useState, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { ValuationHistory } from "@/lib/services/ticker-view.service";

// --- HELPERS ---
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

// --- METRICS DEFINITION ---
const METRICS_CONFIG = [
  { label: "P/E", key: "pe_ratio", format: (v: number) => v?.toFixed(2) },
  { label: "P/S", key: "price_to_sales", format: (v: number) => v?.toFixed(2) },
  { label: "P/FCF", key: "price_to_fcf", format: (v: number) => v?.toFixed(2) },
  { label: "EV/EBITDA", key: "ev_ebitda", format: (v: number) => v?.toFixed(2) },
  { label: "Market Cap", key: "market_cap", format: (v: number) => formatLargeNumber(v) },
  { label: "Enterprise Value", key: "enterprise_value", format: (v: number) => formatLargeNumber(v) },
  { label: "Net Debt", key: "net_debt", format: (v: number) => formatLargeNumber(v) },
  { label: "EPS TTM", key: "eps_ttm", format: (v: number) => v?.toFixed(2) },
  { label: "Revenue TTM", key: "revenue_ttm", format: (v: number) => formatLargeNumber(v) },
  { label: "FCF TTM", key: "free_cash_flow_ttm", format: (v: number) => formatLargeNumber(v) },
];

// --- EXPLANATIONS ---
const METRIC_EXPLANATIONS: Record<string, { description: string; examples: string[] }> = {
  "P/E": {
    description: "Price-to-Earnings Ratio - Compara el precio de la acción con las ganancias por acción. Un P/E bajo puede indicar que la acción está infravalorada.",
    examples: ["< 12: Potencialmente infravalorado", "12-20: Valoración razonable", "> 25: Posiblemente sobrevalorado"]
  },
  "P/S": {
    description: "Price-to-Sales Ratio - Capitalización vs Ingresos anuales.",
    examples: ["< 2: Conservador", "2-10: Típico", "> 15: Alto crecimiento"]
  },
  "P/FCF": {
    description: "Price-to-Free Cash Flow - Precio vs Flujo de caja libre.",
    examples: ["< 15: Sólido", "15-25: Razonable", "> 30: Caro"]
  },
  "EV/EBITDA": {
    description: "Enterprise Value to EBITDA - Valor empresa (con deuda) vs Ebitda.",
    examples: ["< 8: Atractivo", "8-15: Típico", "> 20: Alto"]
  }
};

export interface ValoracionCardProps {
  symbol: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  peerTicker?: string | null;
  defaultExpanded?: boolean;
  hideExpandButton?: boolean;
  data?: ValuationHistory[];
  peerData?: ValuationHistory[];
  // Legacy
  highlightedMetrics?: string[] | null;
}

export default function ValoracionCard({ 
  symbol, 
  scrollRef, 
  peerTicker, 
  defaultExpanded = false,
  hideExpandButton = false,
  data = [],
  peerData = []
}: ValoracionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const localRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = scrollRef || localRef;
  const [explanationModal, setExplanationModal] = useState<{ isOpen: boolean; selectedMetric: string | null }>({
    isOpen: false,
    selectedMetric: null
  });

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

  // Sort by date descending and take the latest one
  const periods = [...data]
    .sort((a, b) => new Date(b.valuation_date).getTime() - new Date(a.valuation_date).getTime())
    .slice(0, 1);

  // Helper to find peer value
  const getPeerValue = (date: string, key: string) => {
    if (!peerData) return null;
    const peerPeriod = peerData.find(p => p.valuation_date === date);
    return peerPeriod ? (peerPeriod as any)[key] : null;
  };

  const visibleMetrics = expanded ? METRICS_CONFIG : METRICS_CONFIG.slice(0, 5);

  return (
    <>
    <div className="w-full h-full flex flex-col bg-tarjetas overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
      >
        <Table className="min-w-max text-sm border-collapse">
          <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
            <TableRow className="bg-[#1D1D1D] hover:bg-[#1D1D1D] border-b-0">
              <TableHead className="px-2 text-gray-300 text-[10px] h-5 w-[120px] font-light font-nano text-left sticky left-0 z-20 bg-[#1D1D1D] border-r border-zinc-800">
                Valoración
              </TableHead>
              {periods.map((period, idx) => (
                <React.Fragment key={period.valuation_date}>
                  <TableHead className={`px-2 text-gray-300 text-[10px] h-5 text-center whitespace-nowrap ${idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}>
                    {period.valuation_date} (TTM)
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
              <TableRow 
                key={metric.key} 
                className="hover:bg-white/5 border-b border-zinc-800 last:border-0 cursor-pointer group"
                onClick={() => setExplanationModal({ isOpen: true, selectedMetric: metric.label })}
              >
                <TableCell className="font-light text-gray-200 px-2 py-1 text-[10px] h-6 w-[120px] sticky left-0 z-10 bg-[#1D1D1D] border-r border-zinc-800 group-hover:text-blue-400 transition-colors">
                  {metric.label}
                </TableCell>
                {periods.map((period, idx) => {
                  const val = (period as any)[metric.key];
                  const peerVal = getPeerValue(period.valuation_date, metric.key);
                  
                  return (
                    <React.Fragment key={`${metric.key}-${period.valuation_date}`}>
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

      {/* MODAL DE EXPLICACIÓN */}
      {explanationModal.isOpen && explanationModal.selectedMetric && METRIC_EXPLANATIONS[explanationModal.selectedMetric] && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1D1D1D] border border-zinc-700 rounded-lg shadow-2xl max-w-sm w-full p-4 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setExplanationModal({ isOpen: false, selectedMetric: null });
              }}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-[#FFA028] mb-2">{explanationModal.selectedMetric}</h3>
            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              {METRIC_EXPLANATIONS[explanationModal.selectedMetric].description}
            </p>
            <div className="bg-black/20 rounded p-3 border border-zinc-800">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Interpretación</p>
              <ul className="space-y-1.5">
                {METRIC_EXPLANATIONS[explanationModal.selectedMetric].examples.map((ex, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
