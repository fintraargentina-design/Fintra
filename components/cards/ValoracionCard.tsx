"use client";

// fintra/components/cards/ValoracionCard.tsx

import { useState, useEffect } from "react";
import { X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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
  "P/E", 
  "EV/EBITDA", 
  "P/FCF", 
  "Dividend Yield",
  "Div Yield" // Alias common in this codebase
];

// --- TYPES (Adopted from FundamentalCard) ---
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

// EXPLICACIONES (Keys matched to API labels)
const METRIC_EXPLANATIONS: Record<string, { description: string; examples: string[] }> = {
  "P/E": {
    description: "Price-to-Earnings Ratio - Compara el precio de la acción con las ganancias por acción. Un P/E bajo puede indicar que la acción está infravalorada.",
    examples: ["< 12: Potencialmente infravalorado", "12-20: Valoración razonable", "> 25: Posiblemente sobrevalorado"]
  },
  "Forward P/E": {
    description: "P/E basado en ganancias futuras estimadas. Relevante pues descuenta expectativas.",
    examples: ["< Histórico: Crecimiento esperado", "> Histórico: Declive esperado"]
  },
  "PEG": {
    description: "Price/Earnings to Growth - Relaciona el P/E con la tasa de crecimiento esperada.",
    examples: ["< 1: Potencialmente infravalorado", "1: Valoración justa", "> 2: Posiblemente sobrevalorado"]
  },
  "P/B": {
    description: "Price-to-Book Ratio - Compara precio con valor contable.",
    examples: ["< 1: Bajo valor contable", "1-3: Típico", "> 5: Alto (común en tech)"]
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
  },
  "Div Yield": {
    description: "Rendimiento por dividendo anual.",
    examples: ["> 4%: Alto", "2-4%: Moderado", "< 2%: Bajo"]
  }
};

export default function ValoracionCard({ symbol, scrollRef, peerTicker, highlightedMetrics }: { symbol: string; scrollRef?: React.RefObject<HTMLDivElement | null>; peerTicker?: string | null; highlightedMetrics?: string[] | null }) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [peerData, setPeerData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [explanationModal, setExplanationModal] = useState<{ isOpen: boolean; selectedMetric: string | null }>({
    isOpen: false,
    selectedMetric: null
  });
  const [expanded, setExpanded] = useState(false);

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

  const valuationMetrics = data?.metrics?.filter(m => m.category === "valuation") || [];
  
  const visibleMetrics = valuationMetrics.filter(metric => {
    if (expanded) return true;
    return CORE_METRICS.includes(metric.label);
  });

  return (
    <>
      <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
        {/* <div className="px-1 py-1 bg-white/[0.02] shrink-0">
          <h4 className="text-xs font-medium text-gray-400 text-center">
            Valoración de <span className="text-[#FFA028]">{symbol}</span>
          </h4>
        </div> */}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-0 scrollbar-thin">
          <Table className="w-full text-sm border-collapse">
            <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
              <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
                <TableHead className="px-2 text-gray-300 text-[12px] h-6 w-[150px] font-light font-nano text-left sticky left-0 z-20 bg-[#1D1D1D]">Valoración</TableHead>
                {data?.years?.map((year, yearIdx) => (
                  year.columns.flatMap(col => [
                    <TableHead 
                      key={col} 
                      className={`px-2 text-[10px] h-6 text-center whitespace-nowrap ${
                        col === 'TTM' ? 'font-bold text-blue-400' : 
                        col === 'FY' ? 'font-bold text-green-400' : 'text-gray-300'
                      } ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}
                    >
                      {col}
                    </TableHead>,
                    peerTicker && (
                        <TableHead key={`${col}-peer`} className={`px-2 text-[#0056FF] font-bold text-[10px] h-6 text-center whitespace-nowrap ${yearIdx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-white/[0.05]'}`}>
                            {peerTicker}
                        </TableHead>
                    )
                  ])
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow>
                   <TableCell colSpan={100} className="text-center py-8 text-xs text-gray-500">
                     <Loader2 className="w-4 h-4 animate-spin inline mr-2"/> Cargando valoración...
                   </TableCell>
                 </TableRow>
              ) : (
                visibleMetrics.map((metric) => {
                const isHighlighted = highlightedMetrics?.includes(metric.label);
                return (
                  <TableRow 
                    key={metric.key} 
                    className={`border-zinc-800 border-b cursor-pointer group transition-all duration-300 ${isHighlighted ? 'bg-[#FFA028]/10 border-l-2 border-l-[#FFA028] shadow-[inset_0_0_20px_rgba(255,160,40,0.05)]' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                    onClick={() => setExplanationModal({ isOpen: true, selectedMetric: metric.label })}
                  >
                  <TableCell className="font-bold text-gray-200 px-2 py-0.5 text-xs w-[120px] border-r border-zinc-800 group-hover:text-blue-400 transition-colors sticky left-0 z-10 bg-[#1D1D1D]">
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
                Ver más Métricas de Valoracion <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL DE EXPLICACIÓN */}
      {explanationModal.isOpen && explanationModal.selectedMetric && METRIC_EXPLANATIONS[explanationModal.selectedMetric] && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1D1D1D] border border-zinc-700 rounded-lg shadow-2xl max-w-sm w-full p-4 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setExplanationModal({ isOpen: false, selectedMetric: null })}
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
