"use client";

import React, { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { FintraLoader } from "@/components/ui/FintraLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getHeatmapColor, HeatmapDirection } from "@/lib/ui/heatmap";

// Helper to determine text color based on heatmap intensity
function getTextColor(normalized: number | null | undefined): string {
  if (normalized == null || Number.isNaN(normalized)) {
    return "text-white";
  }
  const value = Math.max(0, Math.min(1, normalized));
  const idx = Math.min(4, Math.floor(value * 5));
  // For weak (0) and very weak (1) intensities, use white text
  // For moderate (2), strong (3), and very strong (4), use black text
  return idx <= 1 ? "text-white" : "text-black";
}

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

interface MetricExplanation {
  description: string;
  examples: string[];
}

interface GenericTimelineTableProps {
  symbol: string;
  peerTicker?: string | null;
  endpoint: string; // e.g., "fundamentals-timeline"
  title: string;
  coreMetrics?: string[];
  metricExplanations?: Record<string, MetricExplanation>;
  filterMetrics?: (metrics: TimelineResponse['metrics']) => TimelineResponse['metrics'];
  processYears?: (years: TimelineResponse['years']) => TimelineResponse['years'];
  renderHeaderCol?: (col: string, yearIdx: number) => React.ReactNode;
}

// --- SHARED EXPLANATIONS (from ValoracionCard) ---
const VALUATION_EXPLANATIONS: Record<string, MetricExplanation> = {
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

const FUNDAMENTAL_CORE_METRICS = [
  "ROIC", "ROE", "Margen neto", "FCF Margin", "Crecimiento Ventas", "Crecimiento Beneficio"
];

const VALUATION_CORE_METRICS = [
  "P/E", "EV/EBITDA", "P/FCF", "Dividend Yield", "Div Yield"
];

const PERFORMANCE_CORE_METRICS = [
  "Retorno Absoluto"
];

// --- GENERIC COMPONENT ---

function GenericTimelineTable({
  symbol,
  peerTicker,
  endpoint,
  title,
  coreMetrics,
  metricExplanations,
  filterMetrics,
  processYears,
  renderHeaderCol
}: GenericTimelineTableProps) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [peerData, setPeerData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [explanationModal, setExplanationModal] = useState<{ isOpen: boolean; selectedMetric: string | null }>({
    isOpen: false,
    selectedMetric: null
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch Main Data
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analysis/${endpoint}?ticker=${symbol}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted) setData(json);
        } else {
            console.error(`Failed to fetch ${endpoint}`);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, [symbol, endpoint]);

  // Fetch Peer Data
  useEffect(() => {
    if (!peerTicker) {
      setPeerData(null);
      return;
    }
    let mounted = true;
    const fetchPeer = async () => {
      try {
        const res = await fetch(`/api/analysis/${endpoint}?ticker=${peerTicker}`);
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
  }, [peerTicker, endpoint]);

  // Scroll to end on load
  useEffect(() => {
    if (!loading && scrollRef.current) {
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
            }
        }, 0);
    }
  }, [loading]);

  // Process Data
  const rawMetrics = data?.metrics || [];
  const filteredMetrics = filterMetrics ? filterMetrics(rawMetrics) : rawMetrics;
  
  // Always show all filtered metrics
  const visibleMetrics = filteredMetrics;

  const rawYears = data?.years || [];
  let years = processYears ? processYears(rawYears) : [...rawYears].sort((a, b) => Number(a.year) - Number(b.year));

  // Sort columns within each year: Q1 -> Q2 -> Q3 -> Q4 -> FY
  years = years.map(year => ({
    ...year,
    columns: [...year.columns].sort((a, b) => {
      const getRank = (col: string) => {
        if (col.includes("Q1")) return 1;
        if (col.includes("Q2")) return 2;
        if (col.includes("Q3")) return 3;
        if (col.includes("Q4")) return 4;
        if (col.includes("FY")) return 5;
        if (col.includes("TTM")) return 6;
        return 7; 
      };
      return getRank(a) - getRank(b);
    })
  }));

  return (
    <>
      <div className="w-full flex flex-col bg-[#0e0e0e]">
        <div
          ref={scrollRef}
          className="flex-1 p-0 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
        >
          <Table className="min-w-max text-sm">
            <TableHeader className="bg-[#0e0e0e] sticky top-0 z-10">
              <TableRow className="border-[#222] hover:bg-[#111] bg-[#0e0e0e] border-b-0">
                <TableHead className="border-2 border-[#222] px-2 text-gray-300 text-[13px] h-5 w-[150px] font-light font-nano text-left sticky left-0 z-20 bg-[#0e0e0e]">
                  {title}
                </TableHead>
                {years.map((year, yearIdx) => (
                  year.columns.flatMap(col => [
                    <TableHead
                      key={`${year.year}-${col}`}
                      className={`px-2 text-[13px] h-5 text-center whitespace-nowrap ${yearIdx % 2 === 0 ? 'bg-[#0e0e0e]' : 'bg-[#111]'}`}
                    >
                      {renderHeaderCol ? renderHeaderCol(col, yearIdx) : <span className="text-gray-300">{col}</span>}
                    </TableHead>,
                    peerTicker && (
                      <TableHead
                        key={`${year.year}-${col}-peer`}
                        className={`px-2 text-[#ffffff] border-x border-[#222] font-light text-[10px] h-5 text-center whitespace-nowrap ${yearIdx % 2 === 0 ? 'bg-[#111]' : 'bg-[#1a1a1a]'}`}
                      >
                        {`${peerTicker}_${col.replace('_FY', '')}`}
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
                    <FintraLoader size={16} className="mr-2 inline-block align-middle"/> <span className="align-middle">Cargando {title.toLowerCase()}...</span>
                  </TableCell>
                </TableRow>
              ) : visibleMetrics.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={100} className="text-center py-8 text-xs text-gray-500">
                        No data available
                    </TableCell>
                 </TableRow>
              ) : (
                visibleMetrics.map((metric) => (
                  <TableRow
                    key={metric.key}
                    className={`border-[#222] border-b transition-all duration-300 ${metricExplanations ? 'cursor-pointer group' : ''} hover:bg-[#111] border-l-2 border-l-transparent`}
                    onClick={() => {
                        if (metricExplanations) {
                            setExplanationModal({ isOpen: true, selectedMetric: metric.label });
                        }
                    }}
                  >
                    <TableCell className={`font-bold text-gray-200 px-2 py-0 text-[13px] h-6 w-[100px] border border-[#222] sticky left-0 z-10 bg-[#0e0e0e] ${metricExplanations ? 'group-hover:text-blue-400 transition-colors' : ''}`}>
                      {metric.label}
                    </TableCell>
                    {years.map((year, yearIdx) => (
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
                            key={`${year.year}-${col}`}
                            className={`text-center px-2 py-0 text-[13px] font-medium ${getTextColor(cellData?.normalized ?? null)} h-6 border-x border-[#222]/50 ${yearIdx % 2 === 0 ? 'bg-transparent' : 'bg-[#111]/20'}`}
                            style={{ backgroundColor: getHeatmapColor(cellData?.normalized ?? null, direction) }}
                          >
                            {cellData?.display ?? "-"}
                          </TableCell>,
                          peerTicker && (
                            <TableCell
                              key={`${year.year}-${col}-peer`}
                              className={`text-center px-2 py-0 text-[13px] font-light ${getTextColor(peerCellData?.normalized ?? null)} h-6 border-x border-[#222] ${yearIdx % 2 === 0 ? 'bg-[#111]' : 'bg-[#1a1a1a]'}`}
                              style={{ backgroundColor: getHeatmapColor(peerCellData?.normalized ?? null, direction) }}
                            >
                              {peerCellData?.display ?? "-"}
                            </TableCell>
                          )
                        ];
                      })
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Explanation Modal */}
      {metricExplanations && explanationModal.isOpen && explanationModal.selectedMetric && metricExplanations[explanationModal.selectedMetric] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e0e] border border-[#333] rounded-lg shadow-2xl max-w-sm w-full p-4 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setExplanationModal({ isOpen: false, selectedMetric: null })}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-white mb-2">{explanationModal.selectedMetric}</h3>
            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              {metricExplanations[explanationModal.selectedMetric].description}
            </p>
            <div className="bg-[#111] rounded p-3 border border-[#222]">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Interpretación</p>
              <ul className="space-y-1.5">
                {metricExplanations[explanationModal.selectedMetric].examples.map((ex, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-white mt-1.5 shrink-0" />
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


// --- MAIN TAB COMPONENT ---

interface DatosFinancierosTabProps {
  stockAnalysis: any;
  stockPerformance?: any;
  stockBasicData?: any;
  ticker: string;
  peerTicker?: string | null;
  ratios?: any;
  metrics?: any;
}

export default function DatosFinancierosTab({
  ticker,
  peerTicker,
}: DatosFinancierosTabProps) {
  return (
    <div className="w-full flex flex-col gap-1 p-1">
      
      {/* 1. FUNDAMENTALES */}
      <GenericTimelineTable
        symbol={ticker}
        peerTicker={peerTicker}
        endpoint="fundamentals-timeline"
        title="Fundamentales"
        coreMetrics={FUNDAMENTAL_CORE_METRICS}
        // Default behavior for years and metrics is fine
      />

      {/* 2. VALORACION */}
      <GenericTimelineTable
        symbol={ticker}
        peerTicker={peerTicker}
        endpoint="valuation-timeline"
        title="Valoración"
        coreMetrics={VALUATION_CORE_METRICS}
        metricExplanations={VALUATION_EXPLANATIONS}
        filterMetrics={(metrics) => metrics.filter(m => m.category === "valuation")}
        renderHeaderCol={(col) => (
            <span className={
                col === 'TTM' ? 'font-bold text-blue-400' :
                col === 'FY' ? 'font-bold text-green-400' : 'text-gray-300'
            }>
                {col}
            </span>
        )}
      />

      {/* 3. DESEMPEÑO */}
      <GenericTimelineTable
        symbol={ticker}
        peerTicker={peerTicker}
        endpoint="performance-timeline"
        title="Desempeño"
        coreMetrics={PERFORMANCE_CORE_METRICS}
        filterMetrics={(metrics) => metrics.filter(m => m.category === "performance")}
        processYears={(years) => {
            // Find the 9999 year group which contains the windows (1D, 1W, etc)
            const perfGroup = years.find(y => y.year === 9999);
            return perfGroup ? [perfGroup] : [];
        }}
        renderHeaderCol={(col) => <span className="text-gray-300">{col}</span>}
      />

      {/* 4. DIVIDENDOS */}
      <GenericTimelineTable
        symbol={ticker}
        peerTicker={peerTicker}
        endpoint="dividends-timeline"
        title="Dividendos"
        // Show all metrics by default (no core filter)
        renderHeaderCol={(col) => <span className="text-gray-300">{col.replace('_FY', '')}</span>}
      />

    </div>
  );
}
