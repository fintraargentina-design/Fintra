"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { X } from "lucide-react";
import { fmp } from "@/lib/fmp/client";
import type { 
  FMPFinancialRatio, 
  FMPKeyMetrics, 
  FMPIncomeStatementGrowth, 
  FMPBalanceSheetGrowth,
  FMPCashFlowStatement 
} from "@/lib/fmp/types";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

// --- HELPERS MATEMÁTICOS ---
const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const pctCap = (x?: number | null, cap = 40) => (x == null ? null : clamp((Math.max(x, 0) / cap) * 100));
const inverseRatio = (x?: number | null, bueno = 0.3, maxMalo = 1.5) => {
  if (x == null) return null;
  const v = Math.min(Math.max(x, 0), maxMalo);
  const score = ((maxMalo - v) / (maxMalo - bueno)) * 100;
  return clamp(score);
};
const sweetSpot = (x?: number | null, ideal = 2, rango = 1.5) => {
  if (x == null) return null;
  const dist = Math.abs(x - ideal);
  const score = (1 - Math.min(dist / rango, 1)) * 100;
  return clamp(score);
};
const logSaturate = (x?: number | null, cap = 20) => {
  if (x == null) return null;
  const v = Math.min(Math.max(x, 0), cap);
  return clamp((Math.log(1 + v) / Math.log(1 + cap)) * 100);
};
const linearCap = (x?: number | null, cap = 60) => (x == null ? null : clamp((x / cap) * 100));

const fmtPercent = (v?: number | null, d = 1) => (v == null ? "N/A" : `${v.toFixed(d)}%`);
const fmtRatio = (v?: number | null, d = 2) => (v == null ? "N/A" : `${v.toFixed(d)}x`);
const fmtMoney = (v?: number | null) => (v == null ? "N/A" : `$${v.toFixed(2)}`);

const numOrNull = (x: any): number | null => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
const pctOrNull = (x: any): number | null => {
  const n = numOrNull(x);
  return n == null ? null : n * 100; // FMP: 0.23 => 23%
};

// --- HEATMAP COLORS (Tu Estética) ---
const getHeatmapColor = (score: number | null) => {
  if (score == null) return "#1e293b";
  if (score >= 90) return "#008000"; 
  if (score >= 80) return "#006600"; 
  if (score >= 70) return "#004D00"; 
  if (score >= 60) return "#003300"; 
  if (score >= 50) return "#001A00"; 
  if (score <= 10) return "#800000"; 
  if (score <= 20) return "#660000"; 
  if (score <= 30) return "#4D0000"; 
  if (score <= 40) return "#330000"; 
  return "#1A0000";
};

const getScoreLevel = (score: number | null): string => {
  if (score == null) return "Sin datos";
  if (score >= 70) return "Fuerte";
  if (score >= 40) return "Medio";
  return "Débil";
};

// --- CAGR CALC ---
function cagrFromGrowthSeries(series: number[]): number | null {
  const valid = series.filter((x) => Number.isFinite(x));
  if (!valid.length) return null;
  const compounded = valid.reduce((acc, r) => acc * (1 + r), 1);
  return (Math.pow(compounded, 1 / valid.length) - 1) * 100;
}

// --- CONFIGURACIÓN DEL MODAL DE EXPLICACIONES ---
const METRIC_EXPLANATIONS: Record<string, { description: string; examples: string[] }> = {
  "ROE": {
    description: "Return on Equity - Mide la rentabilidad que obtienen los accionistas sobre su inversión. Un ROE alto indica que la empresa genera buenos beneficios con el capital de los accionistas.",
    examples: ["ROE > 15%: Excelente", "ROE 10-15%: Buena", "ROE < 10%: Baja"]
  },
  "ROIC": {
    description: "Return on Invested Capital - Evalúa la eficiencia con la que la empresa utiliza todo su capital invertido (deuda + equity).",
    examples: ["ROIC > 12%: Alta Calidad", "ROIC 8-12%: Sólido", "ROIC < 8%: Baja Eficiencia"]
  },
  "Margen bruto": {
    description: "Porcentaje de ingresos que queda después de descontar el costo directo de los productos. Indica poder de precios.",
    examples: ["Software: 80%+", "Retail: 20-30%"]
  },
  "Margen neto": {
    description: "Porcentaje de ingresos que se convierte en beneficio neto final.",
    examples: ["Tech: 20%+", "Retail: 2-5%"]
  },
  "Deuda/Capital": {
    description: "Mide qué porcentaje del capital total proviene de deuda. Menos es mejor (generalmente).",
    examples: ["< 30%: Conservador", "30-60%: Equilibrado", "> 60%: Apalancado"]
  },
  "Current Ratio": {
    description: "Capacidad para pagar deudas a corto plazo con activos corrientes.",
    examples: ["> 1.5: Saludable", "< 1.0: Riesgo de Liquidez"]
  },
  "Cobertura int.": {
    description: "Cuántas veces el beneficio operativo cubre el pago de intereses.",
    examples: ["> 8x: Muy Seguro", "< 3x: Riesgoso"]
  },
  "FCF Margin": {
    description: "Porcentaje de ingresos que se convierte en Flujo de Caja Libre real.",
    examples: ["> 20%: Máquina de Efectivo", "> 10%: Saludable"]
  },
  "CAGR Ventas": {
    description: "Crecimiento anual compuesto de los ingresos en los últimos 5 años.",
    examples: ["> 15%: Alto Crecimiento", "5-10%: Estable"]
  },
  "CAGR Beneficio": {
    description: "Crecimiento anual compuesto de los beneficios netos.",
    examples: ["> 20%: Excelente", "< 0%: Contracción"]
  },
  "CAGR Patrimonio": {
    description: "Crecimiento del valor contable de los accionistas.",
    examples: ["> 10%: Buena creación de valor"]
  },
  "Book Value/Acc": {
    description: "Valor contable teórico por cada acción.",
    examples: ["Creciente: Positivo"]
  }
};

// --- TIPOS ---
type MetricRow = {
  label: string;
  unit?: "%" | "x" | "$";
  raw: number | null;
  score: number | null;
  display: string;
};

type PeriodSel = "ttm" | "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "annual" | "quarter";

interface ExplanationModalState {
  isOpen: boolean;
  selectedMetric: string | null;
}

const initialExplanationModalState: ExplanationModalState = {
  isOpen: false,
  selectedMetric: null
};

// --- SCORING LOGIC ---
function getScoreMeta(label: string, raw: number | null) {
  switch (label) {
    case "ROE": return { score: pctCap(raw, 40) }; 
    case "ROIC": return { score: pctCap(raw, 30) }; 
    case "Margen bruto": return { score: pctCap(raw, 80) }; 
    case "Margen neto": return { score: pctCap(raw, 30) }; 
    case "Deuda/Capital": return { score: inverseRatio(raw, 0.3, 0.6) };
    case "Current Ratio": return { score: sweetSpot(raw, 2, 1.5) };
    case "Cobertura int.": return { score: logSaturate(raw, 20) };
    case "FCF Margin": return { score: pctCap(raw, 25) }; 
    case "CAGR Ventas": return { score: pctCap(raw, 30) }; 
    case "CAGR Beneficio": return { score: pctCap(raw, 40) }; 
    case "CAGR Patrimonio": return { score: pctCap(raw, 25) }; 
    case "Book Value/Acc": return { score: linearCap(raw, 60) };
    default: return { score: null };
  }
}

// --- BUILDER FUNCTION (Cálculos Robustos) ---
function buildMetricRows(
  r: Partial<FMPFinancialRatio>,
  k: Partial<FMPKeyMetrics>,
  growthData: { rev: number[]; net: number[]; eq: number[] },
  cashflowItems: Partial<FMPCashFlowStatement>[]
): MetricRow[] {
  const newRows: MetricRow[] = [];

  // 1. RENTABILIDAD
  const roe = numOrNull(r.returnOnEquityTTM ?? r.returnOnEquity);
  newRows.push({ label: "ROE", unit: "%", raw: roe, ...getScoreMeta("ROE", roe), display: fmtPercent(pctOrNull(roe)) });

  const roic = numOrNull(r.returnOnCapitalEmployedTTM ?? r.returnOnCapitalEmployed);
  newRows.push({ label: "ROIC", unit: "%", raw: roic, ...getScoreMeta("ROIC", roic), display: fmtPercent(pctOrNull(roic)) });

  const grossMargin = numOrNull(r.grossProfitMarginTTM ?? r.grossProfitMargin);
  newRows.push({ label: "Margen bruto", unit: "%", raw: grossMargin, ...getScoreMeta("Margen bruto", grossMargin), display: fmtPercent(pctOrNull(grossMargin)) });

  const netMargin = numOrNull(r.netProfitMarginTTM ?? r.netProfitMargin);
  newRows.push({ label: "Margen neto", unit: "%", raw: netMargin, ...getScoreMeta("Margen neto", netMargin), display: fmtPercent(pctOrNull(netMargin)) });

  // 2. SALUD FINANCIERA
  const debtEquity = numOrNull(r.debtEquityRatioTTM ?? r.debtEquityRatio);
  const debtToCapital = debtEquity != null ? debtEquity / (1 + debtEquity) : null;
  newRows.push({ label: "Deuda/Capital", unit: "%", raw: debtToCapital, ...getScoreMeta("Deuda/Capital", debtToCapital), display: fmtPercent(pctOrNull(debtToCapital)) });

  const currentRatio = numOrNull(r.currentRatioTTM ?? r.currentRatio);
  newRows.push({ label: "Current Ratio", unit: "x", raw: currentRatio, ...getScoreMeta("Current Ratio", currentRatio), display: fmtRatio(currentRatio) });

  const interestCov = numOrNull(r.interestCoverageTTM ?? r.interestCoverage);
  newRows.push({ label: "Cobertura int.", unit: "x", raw: interestCov, ...getScoreMeta("Cobertura int.", interestCov), display: fmtRatio(interestCov) });

  // 3. FLUJO DE CAJA (FCF)
  let fcfMargin: number | null = null;
  // A. Cálculo preciso desde Cashflow
  if (cashflowItems.length > 0) {
    const item = cashflowItems[0]; 
    const fcf = numOrNull(item.freeCashFlow);
    const revenueCalc = (numOrNull(k.revenuePerShareTTM) || 0) * (numOrNull(k.sharesOutstanding) || 0);
    if (fcf != null && revenueCalc > 0) fcfMargin = fcf / revenueCalc;
  }
  // B. Fallback a Key Metrics
  if (fcfMargin == null) {
    const revPerShare = numOrNull(k.revenuePerShareTTM ?? k.revenuePerShare);
    const fcfPerShare = numOrNull(k.freeCashFlowPerShareTTM ?? k.freeCashFlowPerShare);
    if (revPerShare && fcfPerShare && revPerShare !== 0) fcfMargin = fcfPerShare / revPerShare;
  }
  newRows.push({ label: "FCF Margin", unit: "%", raw: fcfMargin, ...getScoreMeta("FCF Margin", fcfMargin), display: fmtPercent(pctOrNull(fcfMargin)) });

  // 4. CRECIMIENTO (CAGR)
  const cagrRev = cagrFromGrowthSeries(growthData.rev);
  newRows.push({ label: "CAGR Ventas", unit: "%", raw: cagrRev, ...getScoreMeta("CAGR Ventas", cagrRev), display: fmtPercent(cagrRev) });

  const cagrNet = cagrFromGrowthSeries(growthData.net);
  newRows.push({ label: "CAGR Beneficio", unit: "%", raw: cagrNet, ...getScoreMeta("CAGR Beneficio", cagrNet), display: fmtPercent(cagrNet) });

  const cagrEq = cagrFromGrowthSeries(growthData.eq);
  newRows.push({ label: "CAGR Patrimonio", unit: "%", raw: cagrEq, ...getScoreMeta("CAGR Patrimonio", cagrEq), display: fmtPercent(cagrEq) });

  // 5. VALOR
  const bookVal = numOrNull(k.bookValuePerShareTTM ?? k.bookValuePerShare);
  newRows.push({ label: "Book Value/Acc", unit: "$", raw: bookVal, ...getScoreMeta("Book Value/Acc", bookVal), display: fmtMoney(bookVal) });

  return newRows;
}

// --- COMPONENTE PRINCIPAL ---
export default function FundamentalCard({ 
  symbol, 
  period = "annual",
  ratiosData,
  metricsData
}: { 
  symbol: string; 
  period?: PeriodSel;
  ratiosData?: any;
  metricsData?: any;
}) {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Estado del Modal
  const [explanationModal, setExplanationModal] = useState<ExplanationModalState>(initialExplanationModalState);

  const openExplanationModal = (metricName: string) => {
    setExplanationModal({ isOpen: true, selectedMetric: metricName });
  };
  const closeExplanationModal = () => {
    setExplanationModal(initialExplanationModalState);
  };

  useEffect(() => {
    if (!symbol) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // 1. Fetch History (siempre annual para CAGR y FCF consistente)
        const [incomeGrowth, balanceGrowth, cashflow] = await Promise.all([
          fmp.incomeStatementGrowth(symbol, { period: "annual", limit: 6 }),
          fmp.balanceSheetGrowth(symbol, { period: "annual", limit: 6 }),
          fmp.cashflow(symbol, { period: "annual", limit: 2 })
        ]);

        const growthData = {
          rev: Array.isArray(incomeGrowth) ? incomeGrowth.map((x: any) => x.growthRevenue) : [],
          net: Array.isArray(incomeGrowth) ? incomeGrowth.map((x: any) => x.growthNetIncome) : [],
          eq: Array.isArray(balanceGrowth) ? balanceGrowth.map((x: any) => x.growthShareholdersEquity) : []
        };
        const cfItems = Array.isArray(cashflow) ? cashflow : [];

        // 2. Determinar Ratios y Metrics según periodo seleccionado
        let currentRatios;
        let currentMetrics;

        if (period === 'ttm') {
          // Si el usuario pide TTM, usamos props (que suelen ser TTM) si existen, o fetch explícito
          if (ratiosData && metricsData) {
            currentRatios = ratiosData;
            currentMetrics = metricsData;
          } else {
            const [r, k] = await Promise.all([
              fmp.ratiosTTM(symbol),
              fmp.keyMetricsTTM(symbol)
            ]);
            currentRatios = r?.[0] || {};
            currentMetrics = k?.[0] || {};
          }
        } else {
          // Si el usuario pide Annual/Quarter, ignoramos props TTM y hacemos fetch específico
          // Mapeo: 'annual' | 'FY' -> 'annual', cualquier otro (Q1..Q4, quarter) -> 'quarter'
          const apiPeriod = (period === 'annual' || period === 'FY') ? 'annual' : 'quarter';
          
          const [r, k] = await Promise.all([
            fmp.ratios(symbol, { period: apiPeriod, limit: 1 }),
            fmp.keyMetrics(symbol, { period: apiPeriod, limit: 1 })
          ]);
          currentRatios = r?.[0] || {};
          currentMetrics = k?.[0] || {};
        }

        console.log(`[FundamentalCard] Inputs for ${symbol}:`, { currentRatios, currentMetrics, growthData });

        const fullRows = buildMetricRows(currentRatios, currentMetrics, growthData, cfItems);
        console.log(`[FundamentalCard] Rows built for ${symbol}:`, fullRows);
        setRows(fullRows);
      
      } catch (err) {
        console.error("Error fetching history/data:", err);
        setError("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

  }, [symbol, period, ratiosData, metricsData]);

  return (
    <>
      <div className="bg-tarjetas border-none px-6 pb-0 pt-2">
        {loading && rows.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-gray-500 text-xs animate-pulse"> 
            Analizando fundamentales...
          </div>
        ) : error ? (
          <div className="h-24 flex items-center justify-center text-red-400 text-xs">{error}</div>
        ) : (
          /* HEATMAP GRID - TU DISEÑO ORIGINAL RESTAURADO */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-0.5">
            {rows.map((row, index) => (
              <div 
                key={index} 
                className="relative flex flex-col items-center justify-center p-2 gap-0.5 cursor-pointer hover:brightness-110 transition-all border border-white/5"
                style={{ backgroundColor: getHeatmapColor(row.score) }}
                onClick={() => openExplanationModal(row.label)}
              >
                <div className="text-white/60 text-[10px] font-semibold tracking-wider text-center line-clamp-1">
                  {row.label}
                </div>
                <div className="text-white text-sm tracking-tight">
                  {row.display}
                </div>
                <div className="text-[9px] text-white/80 bg-black/20 px-1.5 rounded mt-0.5">
                  {getScoreLevel(row.score)}
                </div>                    
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL EXPLICATIVO RESTAURADO */}
      {explanationModal.isOpen && explanationModal.selectedMetric && METRIC_EXPLANATIONS[explanationModal.selectedMetric] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-100 border border-gray-300 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  {explanationModal.selectedMetric}
                </h2>
                <button
                  onClick={closeExplanationModal}
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
                    onClick={closeExplanationModal}
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