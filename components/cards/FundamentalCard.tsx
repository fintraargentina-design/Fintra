"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { X } from "lucide-react";
import { fmp } from "@/lib/fmp/client";
import type { FMPFinancialRatio, FMPIncomeStatementGrowth, FMPKeyMetrics, FMPCashFlowStatement, FMPCompanyProfile, FMPBalanceSheetGrowth } from "@/lib/fmp/types";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

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

// Función para formatear números grandes con T/B/M
const fmtLargeNumber = (v?: number | null, d = 1) => {
  if (v == null) return "N/A";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(d)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(d)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(d)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(d)}K`;
  return `$${v.toFixed(0)}`;
};

// Función para obtener el color del score
const getScoreColor = (score: number | null): string => {
  if (score == null) return "#94a3b8";
  if (score >= 70) return "#22c55e"; // Verde
  if (score >= 40) return "#eab308"; // Amarillo
  return "#ef4444"; // Rojo
};


// Función para obtener el texto del nivel de score
const getScoreLevel = (score: number | null): string => {
  if (score == null) return "Sin datos";
  if (score >= 70) return "Fuerte";
  if (score >= 40) return "Medio";
  return "Débil";
};

function cagrFromGrowthSeries(series: number[]): number | null {
  const valid = series.filter((x) => Number.isFinite(x));
  if (!valid.length) return null;
  const compounded = valid.reduce((acc, r) => acc * (1 + r), 1);
  return (Math.pow(compounded, 1 / valid.length) - 1) * 100;
}

// ─────────────────────────────
// Helpers de normalización numérica (evita NaN)
// ─────────────────────────────
const numOrNull = (x: any): number | null => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
const pctOrNull = (x: any): number | null => {
  const n = numOrNull(x);
  return n == null ? null : n * 100; // FMP: 0.23 => 23%
};

type MetricRow = {
  label: string;
  unit?: "%" | "x" | "$";
  raw: number | null;
  score: number | null;
  target: number | null;
  thresholds: { poor: number; avg: number };
  display: string;
};

function getScoreMeta(label: string, raw: number | null) {
  switch (label) {
    case "ROE":
      return { score: pctCap(raw, 40), target: (15 / 40) * 100, thresholds: { poor: (10 / 40) * 100, avg: (20 / 40) * 100 } };
    case "ROIC":
      return { score: pctCap(raw, 40), target: (12 / 40) * 100, thresholds: { poor: (8 / 40) * 100, avg: (15 / 40) * 100 } };
    case "Margen bruto":
      return { score: pctCap(raw, 80), target: (40 / 80) * 100, thresholds: { poor: (25 / 80) * 100, avg: (35 / 80) * 100 } };
    case "Margen neto":
      return { score: pctCap(raw, 30), target: (15 / 30) * 100, thresholds: { poor: (7 / 30) * 100, avg: (12 / 30) * 100 } };
    case "Deuda/Capital":
      // Convertir D/E a D/(D+E)
      const debtToCapital = raw == null ? null : raw / (1 + raw);
      return { score: inverseRatio(debtToCapital, 0.3, 0.6), target: inverseRatio(0.45, 0.3, 0.6), thresholds: { poor: 40, avg: 70 } };
    case "Current Ratio":
      return { score: sweetSpot(raw, 2, 1.5), target: sweetSpot(2, 2, 1.5), thresholds: { poor: 40, avg: 70 } };
    case "Cobertura de intereses":
      return { score: logSaturate(raw, 20), target: logSaturate(8, 20), thresholds: { poor: 40, avg: 70 } };
    case "Flujo de Caja Libre (%)":
      return { score: pctCap(raw, 30), target: (10 / 30) * 100, thresholds: { poor: (5 / 30) * 100, avg: (12 / 30) * 100 } };
    case "CAGR ingresos":
      return { score: pctCap(raw, 30), target: (10 / 30) * 100, thresholds: { poor: (5 / 30) * 100, avg: (12 / 30) * 100 } };
    case "CAGR beneficios":
      return { score: pctCap(raw, 40), target: (15 / 40) * 100, thresholds: { poor: (8 / 40) * 100, avg: (20 / 40) * 100 } };
    case "CAGR patrimonio":
      return { score: pctCap(raw, 25), target: (10 / 25) * 100, thresholds: { poor: (5 / 25) * 100, avg: (12 / 25) * 100 } };
    case "Book Value por acción":
      return { score: linearCap(raw, 60), target: (20 / 60) * 100, thresholds: { poor: (10 / 60) * 100, avg: (30 / 60) * 100 } };
    case "Rev/Share":
      return { score: pctCap(raw, 20), target: 10, thresholds: { poor: 5, avg: 8 } }; // Changed logic or kept same?
    case "Profit/Share":
    default:
      return { score: null, target: null, thresholds: { poor: 40, avg: 70 } };
  }
}

// Agregar interfaces para la respuesta de n8n
interface AnalysisResponse {
  impacto: string;
  analisis: string;
}

interface AnalysisState {
  isOpen: boolean;
  isLoading: boolean;
  data: AnalysisResponse | null;
  error: string | null;
}

const initialAnalysisState: AnalysisState = {
  isOpen: false,
  isLoading: false,
  data: null,
  error: null
};

// Función para obtener color del impacto
const getImpactColor = (impacto: string): string => {
  switch (impacto?.toLowerCase()) {
    case 'positivo':
    case 'muy positivo':
      return 'text-green-400';
    case 'negativo':
    case 'muy negativo':
      return 'text-red-400';
    case 'neutral':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
};

// Agregar al inicio del archivo, después de los imports existentes
interface ExplanationModalState {
  isOpen: boolean;
  selectedMetric: string | null;
}

const initialExplanationModalState: ExplanationModalState = {
  isOpen: false,
  selectedMetric: null
};

// Actualizar METRIC_EXPLANATIONS con ejemplos
const METRIC_EXPLANATIONS: Record<string, { description: string; examples: string[] }> = {
  "ROE": {
    description: "Return on Equity - Mide la rentabilidad que obtienen los accionistas sobre su inversión. Un ROE alto indica que la empresa genera buenos beneficios con el capital de los accionistas.",
    examples: [
      "ROE > 15%: Excelente rentabilidad (ej: Apple ~30%)",
      "ROE 10-15%: Buena rentabilidad (ej: Microsoft ~25%)",
      "ROE < 10%: Rentabilidad baja (ej: Utilities ~8%)"
    ]
  },
  "ROIC": {
    description: "Return on Invested Capital - Evalúa la eficiencia con la que la empresa utiliza todo su capital invertido para generar beneficios. Es clave para valorar la calidad del negocio.",
    examples: [
      "ROIC > 12%: Negocio de alta calidad",
      "ROIC 8-12%: Negocio sólido",
      "ROIC < 8%: Negocio con baja eficiencia de capital"
    ]
  },
  "Margen bruto": {
    description: "Porcentaje de ingresos que queda después de descontar el costo directo de los productos vendidos. Un margen alto indica ventaja competitiva y poder de fijación de precios.",
    examples: [
      "Software: 80-90% (ej: Microsoft)",
      "Farmacéuticas: 60-80% (ej: Pfizer)",
      "Retail: 20-40% (ej: Walmart)"
    ]
  },
  "Margen neto": {
    description: "Porcentaje de ingresos que se convierte en beneficio neto después de todos los gastos. Refleja la eficiencia operativa y la rentabilidad final del negocio.",
    examples: [
      "Tech: 15-25% (ej: Apple ~23%)",
      "Bancos: 20-30% (ej: JPMorgan ~25%)",
      "Retail: 2-5% (ej: Amazon ~3%)"
    ]
  },
  "Deuda/Capital": {
    description: "Ratio que mide el nivel de endeudamiento respecto al capital total. Un ratio bajo indica menor riesgo financiero y mayor solidez del balance.",
    examples: [
      "< 0.3: Muy conservador (ej: Apple)",
      "0.3-0.6: Equilibrado (ej: Microsoft)",
      "> 0.6: Alto apalancamiento (ej: Utilities)"
    ]
  },
  "Current Ratio": {
    description: "Capacidad de la empresa para pagar sus deudas a corto plazo con sus activos corrientes. Un ratio entre 1.5-3 se considera saludable.",
    examples: [
      "< 1: Riesgo de liquidez",
      "1.5-3: Liquidez saludable",
      "> 3: Exceso de efectivo (puede ser ineficiente)"
    ]
  },
  "Cobertura de intereses": {
    description: "Número de veces que la empresa puede pagar los intereses de su deuda con sus beneficios. Un ratio alto indica menor riesgo de impago.",
    examples: [
      "> 8x: Muy seguro",
      "4-8x: Seguro",
      "< 4x: Riesgo de impago"
    ]
  },
  "Flujo de Caja Libre": {
    description: "Dinero generado por las operaciones después de inversiones en capital. Es crucial para evaluar la capacidad de generar efectivo real.",
    examples: [
      "Positivo y creciente: Ideal",
      "Positivo pero volátil: Aceptable",
      "Negativo: Preocupante (salvo empresas en crecimiento)"
    ]
  },
  "CAGR ingresos": {
    description: "Tasa de crecimiento anual compuesta de los ingresos durante los últimos 5 años. Indica la consistencia del crecimiento del negocio.",
    examples: [
      "> 15%: Crecimiento alto (ej: Tesla)",
      "5-15%: Crecimiento sólido (ej: Microsoft)",
      "< 5%: Crecimiento lento (ej: Utilities)"
    ]
  },
  "CAGR beneficios": {
    description: "Tasa de crecimiento anual compuesta de los beneficios durante los últimos 5 años. Refleja la capacidad de convertir crecimiento en rentabilidad.",
    examples: [
      "> 20%: Excelente (ej: NVIDIA)",
      "10-20%: Muy bueno (ej: Apple)",
      "< 10%: Moderado"
    ]
  },
  "CAGR patrimonio": {
    description: "Tasa de crecimiento anual compuesta del patrimonio neto. Indica cómo crece el valor contable de la empresa para los accionistas.",
    examples: [
      "> 12%: Excelente creación de valor",
      "8-12%: Buena creación de valor",
      "< 8%: Creación de valor limitada"
    ]
  },
  "Book Value por acción": {
    description: "Valor contable de la empresa dividido por el número de acciones. Representa el valor teórico de cada acción según los libros contables.",
    examples: [
      "Crecimiento constante: Buena señal",
      "Estancado: Neutral",
      "Decreciente: Posible destrucción de valor"
    ]
  },
  "Capitalización de Mercado": {
    description: "Valor total de la empresa en el mercado (precio por acción × número de acciones). Refleja lo que los inversores están dispuestos a pagar por la empresa.",
    examples: [
      "Large Cap: > $10B (ej: Apple $3T)",
      "Mid Cap: $2-10B",
      "Small Cap: < $2B"
    ]
  }
};

type PeriodSel = "ttm" | "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "annual" | "quarter";

export default function FundamentalCard({ symbol, period = "annual" }: { symbol: string; period?: PeriodSel }) {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explanationModal, setExplanationModal] = useState<ExplanationModalState>(initialExplanationModalState);

  // Función para abrir modal de explicaciones
  const openExplanationModal = (metricName: string) => {
    setExplanationModal({
      isOpen: true,
      selectedMetric: metricName
    });
  };

  // Función para cerrar modal de explicaciones
  const closeExplanationModal = () => {
    setExplanationModal(initialExplanationModalState);
  };

  useEffect(() => {
    if (!symbol) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Selección de periodo para ratios
        const quarterMap: Record<Exclude<PeriodSel, "ttm" | "FY" | "annual" | "quarter">, string> = {
          Q1: "-03-31",
          Q2: "-06-30",
          Q3: "-09-30",
          Q4: "-12-31",
        } as const;

        let r: Partial<FMPFinancialRatio> = {};
        if (period === "ttm") {
          const ratiosData = await fmp.ratiosTTM(symbol);
          r = Array.isArray(ratiosData) && ratiosData.length ? ratiosData[0] : {};
        } else if (period === "FY") {
          const ratiosAnnual = await fmp.ratios(symbol, { period: "annual", limit: 1 });
          r = Array.isArray(ratiosAnnual) && ratiosAnnual.length ? ratiosAnnual[0] : {};
        } else if (period === "Q1" || period === "Q2" || period === "Q3" || period === "Q4") {
          const ratiosQuarter = await fmp.ratios(symbol, { period: "quarter", limit: 8 });
          const key = quarterMap[period];
          const match = Array.isArray(ratiosQuarter)
            ? ratiosQuarter.find((row: any) => String(row?.date ?? "").includes(key))
            : undefined;
          r = match ?? (Array.isArray(ratiosQuarter) && ratiosQuarter.length ? ratiosQuarter[0] : {});
        } else {
          const ratiosAny = await fmp.ratios(symbol, { period: period as "annual" | "quarter", limit: 1 });
          r = Array.isArray(ratiosAny) && ratiosAny.length ? ratiosAny[0] : {};
        }

        // Key Metrics
        let k: Partial<FMPKeyMetrics> = {};
        if (period === "ttm") {
          const keyMetrics = await fmp.keyMetricsTTM(symbol);
          k = Array.isArray(keyMetrics) && keyMetrics.length ? keyMetrics[0] : {};
        } else if (period === "FY") {
          const kmAnnual = await fmp.keyMetrics(symbol, { period: "annual", limit: 1 });
          k = Array.isArray(kmAnnual) && kmAnnual.length ? kmAnnual[0] : {};
        } else if (period === "Q1" || period === "Q2" || period === "Q3" || period === "Q4") {
          const kmQuarter = await fmp.keyMetrics(symbol, { period: "quarter", limit: 8 });
          const key = quarterMap[period];
          const match = Array.isArray(kmQuarter)
            ? kmQuarter.find((row: any) => String(row?.date ?? "").includes(key))
            : undefined;
          k = match ?? (Array.isArray(kmQuarter) && kmQuarter.length ? kmQuarter[0] : {});
        } else {
          const kmAny = await fmp.keyMetrics(symbol, { period: period as "annual" | "quarter", limit: 1 });
          k = Array.isArray(kmAny) && kmAny.length ? kmAny[0] : {};
        }

        // Profile (para market cap si no está en key metrics)
        const profile = await fmp.profile(symbol);
        const p: Partial<FMPCompanyProfile> = Array.isArray(profile) && profile.length ? profile[0] : {};

        // Growth (5y) -> Tomamos 6 para calcular 5 CAGRs? O simplemente 5 periodos anuales.
        // CAGR = (End/Start)^(1/n) - 1. Para 5 años, necesitamos dato hoy y dato hace 5 años.
        const incomeGrowth = await fmp.incomeStatementGrowth(symbol, { period: "annual", limit: 6 });
        const balanceGrowth = await fmp.balanceSheetGrowth(symbol, { period: "annual", limit: 6 });
        // const cashGrowth = await fmp.cashFlowStatementGrowth(symbol, { period: "annual", limit: 6 });

        // Helpers para extraer arrays de crecimiento
        const revenueGrowthSeries = Array.isArray(incomeGrowth) ? incomeGrowth.map((x: any) => x.growthRevenue) : [];
        const netIncomeGrowthSeries = Array.isArray(incomeGrowth) ? incomeGrowth.map((x: any) => x.growthNetIncome) : [];
        // No hay growthEquity directo en balanceSheetGrowth, calcular a mano desde balanceSheet?
        // FMP tiene "balance-sheet-statement-growth" pero a veces es limitado.
        // Usemos growthShareholdersEquity si existe o calcular.
        // En FMP BalanceSheetGrowth existe "growthShareholdersEquity"? Revisar tipos.
        // Si no, ignoramos o usamos book value growth.
        // Vamos a asumir que balanceGrowth tiene growthShareholdersEquity (si no, null).
        const equityGrowthSeries = Array.isArray(balanceGrowth) ? balanceGrowth.map((x: any) => x.growthShareholdersEquity) : [];

        // Construir filas
        const newRows: MetricRow[] = [];

        // 1. Rentabilidad
        const roe = numOrNull(r.returnOnEquity);
        newRows.push({ label: "ROE", unit: "%", raw: roe, ...getScoreMeta("ROE", roe), display: fmtPercent(pctOrNull(roe)) });

        const roic = numOrNull(r.returnOnCapitalEmployed); // FMP usa returnOnCapitalEmployed como proxy de ROIC a veces
        newRows.push({ label: "ROIC", unit: "%", raw: roic, ...getScoreMeta("ROIC", roic), display: fmtPercent(pctOrNull(roic)) });

        const grossMargin = numOrNull(r.grossProfitMargin);
        newRows.push({ label: "Margen bruto", unit: "%", raw: grossMargin, ...getScoreMeta("Margen bruto", grossMargin), display: fmtPercent(pctOrNull(grossMargin)) });

        const netMargin = numOrNull(r.netProfitMargin);
        newRows.push({ label: "Margen neto", unit: "%", raw: netMargin, ...getScoreMeta("Margen neto", netMargin), display: fmtPercent(pctOrNull(netMargin)) });

        // 2. Salud Financiera
        const debtEq = numOrNull(r.debtEquityRatio);
        newRows.push({ label: "Deuda/Capital", unit: "x", raw: debtEq, ...getScoreMeta("Deuda/Capital", debtEq), display: fmtRatio(debtEq) });

        const currentRatio = numOrNull(r.currentRatio);
        newRows.push({ label: "Current Ratio", unit: "x", raw: currentRatio, ...getScoreMeta("Current Ratio", currentRatio), display: fmtRatio(currentRatio) });

        const interestCov = numOrNull(r.interestCoverage);
        newRows.push({ label: "Cobertura de intereses", unit: "x", raw: interestCov, ...getScoreMeta("Cobertura de intereses", interestCov), display: fmtRatio(interestCov) });

        // Free Cash Flow Yield? O FCF/Sales?
        // Usemos FCF / Revenue (Margin) o FCF Yield.
        // Aquí "Flujo de Caja Libre (%)" suele referirse a FCF Margin.
        // FCF = operatingCashFlow - capitalExpenditure
        // FMP keyMetrics tiene freeCashFlowPerShare?
        // Calculemos FCF Margin usando ratiosTTM o similar. ratios tiene operatingCashFlowPerShare / revenuePerShare?
        // Mejor usar keyMetrics.freeCashFlowYield o calcular FCF/Revenue.
        // Usemos operatingCashFlow - capex.
        // Si no tenemos raw values, busquemos en ratios. cashFlowToDebtRatio? No.
        // keyMetrics tiene freeCashFlowYield.
        // Vamos a usar "FCF Margin" si podemos, o "FCF Yield".
        // Para simplificar, usemos freeCashFlowYield de keyMetrics como "Flujo de Caja Libre (%)" (Yield).
        // Ojo, FCF Yield es sobre Market Cap.
        // Si el usuario quiere "Margen FCF", sería FCF/Sales.
        // FMP ratios tiene "freeCashFlowOperatingCashFlowRatio"? No.
        // Vamos a intentar calcular FCF Margin desde Key Metrics (Revenue per share / FCF per share)?
        // keyMetrics: revenuePerShare, freeCashFlowPerShare.
        const revPerShare = numOrNull(k.revenuePerShare);
        const fcfPerShare = numOrNull(k.freeCashFlowPerShare);
        let fcfMargin: number | null = null;
        if (revPerShare && fcfPerShare && revPerShare !== 0) {
          fcfMargin = fcfPerShare / revPerShare;
        }
        newRows.push({ label: "Flujo de Caja Libre (%)", unit: "%", raw: fcfMargin, ...getScoreMeta("Flujo de Caja Libre (%)", fcfMargin), display: fmtPercent(pctOrNull(fcfMargin)) });

        // 3. Crecimiento (5y CAGR)
        const cagrRev = cagrFromGrowthSeries(revenueGrowthSeries.map(numOrNull).filter(x => x !== null) as number[]);
        newRows.push({ label: "CAGR ingresos", unit: "%", raw: cagrRev, ...getScoreMeta("CAGR ingresos", cagrRev), display: fmtPercent(cagrRev) });

        const cagrNet = cagrFromGrowthSeries(netIncomeGrowthSeries.map(numOrNull).filter(x => x !== null) as number[]);
        newRows.push({ label: "CAGR beneficios", unit: "%", raw: cagrNet, ...getScoreMeta("CAGR beneficios", cagrNet), display: fmtPercent(cagrNet) });

        const cagrEq = cagrFromGrowthSeries(equityGrowthSeries.map(numOrNull).filter(x => x !== null) as number[]);
        newRows.push({ label: "CAGR patrimonio", unit: "%", raw: cagrEq, ...getScoreMeta("CAGR patrimonio", cagrEq), display: fmtPercent(cagrEq) });

        // 4. Valoración / Otros
        const bookVal = numOrNull(k.bookValuePerShare);
        newRows.push({ label: "Book Value por acción", unit: "$", raw: bookVal, ...getScoreMeta("Book Value por acción", bookVal), display: bookVal ? `$${bookVal.toFixed(2)}` : "N/A" });

        setRows(newRows);
      } catch (err) {
        console.error(err);
        setError("Error cargando datos fundamentales");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, period]);

  return (
    <>
      <div className="bg-tarjetas border-none px-6 pb-6">
        {loading ? (
          <div className="h-32 grid place-items-center text-gray-500 text-sm"> 
            Cargando datos de Fundamentales…
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-red-400">{error}</div>
        ) : (
          <>
            {/* Métricas fundamentales en formato de tarjetas */}
            <div className="grid grid-cols-4 gap-2 text-sm">
              {rows.map((row, index) => {
                const scoreColor = getScoreColor(row.score);
                const scoreLevel = getScoreLevel(row.score);

                return (
                  <div 
                    key={index} 
                    className="bg-gray-800/50 rounded p-3 cursor-pointer hover:bg-gray-800/70 transition-colors"
                    onClick={() => openExplanationModal(row.label)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-gray-400 text-xs">{row.label}</div>
                      <div 
                        className="text-xs text-gray-500" 
                        style={{ color: scoreColor }}>
                        {scoreLevel}
                      </div>
                    </div>
                    <div 
                      className="font-mono text-lg mt-1"
                      style={{ color: scoreColor }}
                    >
                      {row.display || "N/A"}
                    </div>                    
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de Explicaciones de Métricas */}
      {explanationModal.isOpen && explanationModal.selectedMetric && METRIC_EXPLANATIONS[explanationModal.selectedMetric] && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-100 border border-gray-300 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* Header del modal */}
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

              {/* Contenido del modal */}
              <div className="space-y-4">
                {/* Descripción */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Descripción</h3>
                  <p className="text-gray-800 leading-relaxed">
                    {METRIC_EXPLANATIONS[explanationModal.selectedMetric].description}
                  </p>
                </div>

                {/* Ejemplos */}
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Ejemplos y Rangos</h3>
                  <ul className="space-y-2">
                    {METRIC_EXPLANATIONS[explanationModal.selectedMetric].examples.map((example, index) => (
                      <li key={index} className="text-gray-700 text-sm flex items-start">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
