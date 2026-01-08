"use client";

import { useState, useEffect } from "react";
import { fmp } from "@/lib/fmp/client";
import { X, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MetricData = {
  Q1: number | null;
  Q2: number | null;
  Q3: number | null;
  Q4: number | null;
  TTM: number | null;
  FY: number | null;
};

type MetricRow = {
  label: string;
  unit: "%" | "x" | "$";
  data: MetricData;
  betterLow?: boolean; // Para métricas donde menor es mejor (P/E, PEG, etc)
  thresholds?: { good: number; bad: number }; // good = límite del "bueno", bad = límite del "malo"
};

// Normalizaciones
const numOrNull = (x: any): number | null => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));

// Score logic (adaptada de ValoracionCard original)
const getScore = (val: number | null, betterLow: boolean = false, thresholds?: { good: number; bad: number }) => {
  if (val === null) return null;
  
  if (betterLow) {
    // Para ratios donde MENOR es MEJOR (ej: P/E)
    // good = 10 (excelente), bad = 50 (pésimo)
    // Si val < good (10) -> score 100
    // Si val > bad (50) -> score 0
    const { good = 10, bad = 50 } = thresholds || {};
    const v = Math.max(0, val);
    if (v <= good) return 100;
    if (v >= bad) return 0;
    // Interp lineal inversa
    return ((bad - v) / (bad - good)) * 100;
  } else {
    // Para ratios donde MAYOR es MEJOR (ej: Yield, Growth)
    // good = 20 (excelente), bad = 0 (pésimo)
    const { good = 20, bad = 0 } = thresholds || {};
    // Asumiendo good > bad
    if (val >= good) return 100;
    if (val <= bad) return 0;
    return ((val - bad) / (good - bad)) * 100;
  }
};

const getHeatmapColor = (score: number | null) => {
  if (score == null) return "#1e293b"; // Gris neutro (Sin datos)

  // ESCALA VERDE (Positivo / Saludable / Subvaluado)
  if (score >= 90) return "#008000"; 
  if (score >= 80) return "#006600"; 
  if (score >= 70) return "#004D00"; 
  if (score >= 60) return "#003300"; 
  if (score >= 50) return "#001A00"; 

  // ESCALA ROJA (Negativo / Riesgo / Sobrevaluado)
  if (score <= 10) return "#800000"; 
  if (score <= 20) return "#660000"; 
  if (score <= 30) return "#4D0000"; 
  if (score <= 40) return "#330000"; 
  return "#1A0000";                  
};

const fmt = (v: number | null, unit: string) => 
  v == null ? "-" : unit === "%" ? `${v.toFixed(2)}%` : `${v.toFixed(2)}x`;

// EXPLICACIONES (Mantenidas del original)
const METRIC_EXPLANATIONS: Record<string, { description: string; examples: string[] }> = {
  "P/E (PER)": {
    description: "Price-to-Earnings Ratio - Compara el precio de la acción con las ganancias por acción. Un P/E bajo puede indicar que la acción está infravalorada.",
    examples: ["< 12: Potencialmente infravalorado", "12-20: Valoración razonable", "> 25: Posiblemente sobrevalorado"]
  },
  "P/E forward": {
    description: "P/E basado en ganancias futuras estimadas. Relevante pues descuenta expectativas.",
    examples: ["< Histórico: Crecimiento esperado", "> Histórico: Declive esperado"]
  },
  "PEG": {
    description: "Price/Earnings to Growth - Relaciona el P/E con la tasa de crecimiento esperada.",
    examples: ["< 1: Potencialmente infravalorado", "1: Valoración justa", "> 2: Posiblemente sobrevalorado"]
  },
  "P/Book (P/B)": {
    description: "Price-to-Book Ratio - Compara precio con valor contable.",
    examples: ["< 1: Bajo valor contable", "1-3: Típico", "> 5: Alto (común en tech)"]
  },
  "P/S (Ventas)": {
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
  "EV/Ventas": {
    description: "Enterprise Value to Sales - Valor empresa vs Ventas.",
    examples: ["< 2: Conservador", "> 10: Alto"]
  },
  "Dividend Yield": {
    description: "Rendimiento por dividendo anual.",
    examples: ["> 4%: Alto", "2-4%: Moderado", "< 2%: Bajo"]
  },
  "Crecimiento implícito": {
    description: "Tasa de crecimiento anual implícita en el precio actual (Forward PE / PEG).",
    examples: ["< 5%: Conservador", "5-15%: Moderado", "> 20%: Alto"]
  },
  "Descuento vs. PT": {
    description: "Descuento del precio actual vs Precio Objetivo de analistas.",
    examples: ["> 20%: Upside potencial", "Negativo: Sobre precio objetivo"]
  }
};

export default function ValoracionCard({ symbol }: { symbol: string }) {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [explanationModal, setExplanationModal] = useState<{ isOpen: boolean; selectedMetric: string | null }>({
    isOpen: false,
    selectedMetric: null
  });

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Parallel fetch
        // 1. Valuation TTM (Calculated by API)
        // 2. Ratios Annual & Quarter (Historical)
        // 3. Key Metrics Annual & Quarter (Historical)
        const [
          valTTM,
          ratiosFY,
          ratiosQuarter,
          metricsFY,
          metricsQuarter
        ] = await Promise.all([
          fmp.valuation(symbol, { period: "ttm", cache: "no-store" }).catch(() => ({} as any)),
          fmp.ratios(symbol, { period: "annual", limit: 1 }).catch(() => []),
          fmp.ratios(symbol, { period: "quarter", limit: 4 }).catch(() => []),
          fmp.keyMetrics(symbol, { period: "annual", limit: 1 }).catch(() => []),
          fmp.keyMetrics(symbol, { period: "quarter", limit: 4 }).catch(() => []),
        ]);

        // Helper to extract
        const extract = (
            valTTMValue: any,
            fyList: any[],
            qList: any[],
            field: string,
            isPercentage: boolean = false
        ): MetricData => {
            const res: MetricData = { Q1: null, Q2: null, Q3: null, Q4: null, TTM: null, FY: null };
            
            // TTM from Valuation API (best source for calculated TTMs)
            res.TTM = numOrNull(valTTMValue);

            // FY from Ratios/Metrics
            if (fyList && fyList[0]) {
                const item = fyList[0] as any;
                const v = numOrNull(item[field]);
                res.FY = v !== null && isPercentage ? v * 100 : v; 
            }

            // Quarters
            (qList || []).forEach((q: any) => {
                const period = q.period as string;
                let val = numOrNull(q[field]);
                if (val !== null && isPercentage) val *= 100;

                if (period === "Q1") res.Q1 = val;
                if (period === "Q2") res.Q2 = val;
                if (period === "Q3") res.Q3 = val;
                if (period === "Q4") res.Q4 = val;
            });

            return res;
        };

        const rows: MetricRow[] = [
          { 
            label: "P/E (PER)", unit: "x", betterLow: true, thresholds: { good: 12, bad: 40 },
            data: extract(valTTM.pe, ratiosFY, ratiosQuarter, "priceEarningsRatio") 
          },
          { 
            label: "P/E forward", unit: "x", betterLow: true, thresholds: { good: 12, bad: 40 },
            data: { 
                Q1: null, Q2: null, Q3: null, Q4: null, FY: null, 
                TTM: numOrNull(valTTM.forwardPe) 
            } 
          },
          { 
            label: "PEG", unit: "x", betterLow: true, thresholds: { good: 1, bad: 3 },
            data: extract(valTTM.peg, ratiosFY, ratiosQuarter, "priceEarningsToGrowthRatio") 
          },
          { 
            label: "P/Book (P/B)", unit: "x", betterLow: true, thresholds: { good: 2, bad: 6 },
            data: extract(valTTM.pb, ratiosFY, ratiosQuarter, "priceToBookRatio") 
          },
          { 
            label: "P/S (Ventas)", unit: "x", betterLow: true, thresholds: { good: 2, bad: 12 },
            data: extract(valTTM.ps, ratiosFY, ratiosQuarter, "priceToSalesRatio") 
          },
          { 
            label: "P/FCF", unit: "x", betterLow: true, thresholds: { good: 15, bad: 40 },
            data: extract(valTTM.pfcf, ratiosFY, ratiosQuarter, "priceToFreeCashFlowsRatio") 
          },
          { 
            label: "EV/EBITDA", unit: "x", betterLow: true, thresholds: { good: 8, bad: 25 },
            data: extract(valTTM.evEbitda, metricsFY, metricsQuarter, "enterpriseValueOverEBITDA") 
          },
          { 
            label: "EV/Ventas", unit: "x", betterLow: true, thresholds: { good: 2, bad: 12 },
            data: extract(valTTM.evSales, metricsFY, metricsQuarter, "evToSales") 
          },
          { 
            label: "Dividend Yield", unit: "%", betterLow: false, thresholds: { good: 4, bad: 1 },
            data: extract(valTTM.dividendYield, ratiosFY, ratiosQuarter, "dividendYield", true) 
          },
          { 
            label: "Crecimiento implícito", unit: "%", betterLow: false, thresholds: { good: 15, bad: 5 },
            data: { 
                Q1: null, Q2: null, Q3: null, Q4: null, FY: null, 
                TTM: numOrNull(valTTM.impliedGrowth) 
            } 
          },
          { 
            label: "Descuento vs. PT", unit: "%", betterLow: false, thresholds: { good: 20, bad: 0 },
            data: { 
                Q1: null, Q2: null, Q3: null, Q4: null, FY: null, 
                TTM: numOrNull(valTTM.discountVsPt) 
            } 
          },
        ];

        if (mounted) {
            setMetrics(rows);
            setLoading(false);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [symbol]);

  const renderCell = (row: MetricRow, val: number | null) => {
    const score = getScore(val, row.betterLow, row.thresholds);
    const color = getHeatmapColor(score);
    
    return (
      <TableCell 
        className="text-center px-2 py-0.5 text-[10px] font-medium text-white h-8 border-x border-zinc-800/50 cursor-pointer hover:brightness-110 transition-all"
        style={{ backgroundColor: color }}
        onClick={() => setExplanationModal({ isOpen: true, selectedMetric: row.label })}
      >
        {fmt(val, row.unit)}
      </TableCell>
    );
  };

  return (
    <>
      <div className="w-full h-full flex flex-col bg-tarjetas rounded-none overflow-hidden mt-0">
        <div className="px-1 py-1 bg-white/[0.02] shrink-0">
          <h4 className="text-xs font-medium text-gray-400 text-center">
            Valoración de <span className="text-[#FFA028]">{symbol}</span>
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin">
          <Table className="w-full text-sm border-collapse">
            <TableHeader className="bg-[#1D1D1D] sticky top-0 z-10">
              <TableRow className="border-zinc-800 hover:bg-[#1D1D1D] bg-[#1D1D1D] border-b-0">
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 w-[120px] text-left">Métrica</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center">Q1</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center">Q2</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center">Q3</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center">Q4</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center font-bold text-blue-400">TTM</TableHead>
                <TableHead className="px-2 text-gray-300 text-[10px] h-6 text-center font-bold text-green-400">FY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-xs text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2"/> Cargando valoración...
                    </TableCell>
                  </TableRow>
              ) : (
                metrics.map((row) => (
                  <TableRow key={row.label} className="border-zinc-800 hover:bg-white/5 border-b">
                    <TableCell 
                        className="font-bold text-gray-200 px-2 py-0.5 text-xs w-[120px] border-r border-zinc-800 cursor-pointer hover:text-[#FFA028]"
                        onClick={() => setExplanationModal({ isOpen: true, selectedMetric: row.label })}
                    >
                      {row.label}
                    </TableCell>
                    {renderCell(row, row.data.Q1)}
                    {renderCell(row, row.data.Q2)}
                    {renderCell(row, row.data.Q3)}
                    {renderCell(row, row.data.Q4)}
                    {renderCell(row, row.data.TTM)}
                    {renderCell(row, row.data.FY)}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Modal de Explicaciones */}
      {explanationModal.isOpen && explanationModal.selectedMetric && METRIC_EXPLANATIONS[explanationModal.selectedMetric] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-100 border border-gray-300 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto text-black">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {explanationModal.selectedMetric}
                </h2>
                <button
                  onClick={() => setExplanationModal({ isOpen: false, selectedMetric: null })}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Descripción</h3>
                  <p className="text-gray-800 leading-relaxed">
                    {METRIC_EXPLANATIONS[explanationModal.selectedMetric].description}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Ejemplos y Rangos</h3>
                  <ul className="space-y-2">
                    {METRIC_EXPLANATIONS[explanationModal.selectedMetric].examples.map((example, index) => (
                      <li key={index} className="text-gray-700 text-sm flex items-start">
                        <span className="w-2 h-2 bg-[#FFA028] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setExplanationModal({ isOpen: false, selectedMetric: null })}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
