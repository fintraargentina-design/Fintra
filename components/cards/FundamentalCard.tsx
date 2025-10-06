// components/cards/FundamentalCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { fmp } from "@/lib/fmp/client";
import { savePeriodSelection } from "@/lib/supabase";
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
const fmtRatio = (v?: number | null, d = 2) => (v == null ? "N/A" : v.toFixed(d));

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

export default function FundamentalCard({ symbol, period = "annual", onPeriodChange }: { symbol: string; period?: PeriodSel; onPeriodChange?: (p: PeriodSel) => void }) {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explanationModal, setExplanationModal] = useState<ExplanationModalState>(initialExplanationModalState);
  const [localPeriod, setLocalPeriod] = useState<PeriodSel>(period);

  // Sincronizar el estado local si cambia el prop
  useEffect(() => {
    setLocalPeriod(period);
  }, [period]);

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
        // Usar el periodo local para todas las consultas
        const period = localPeriod;
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

        // Growth según periodo (TTM usa annual)
        const growthPeriod: "annual" | "quarter" = period === "quarter" || period === "Q1" || period === "Q2" || period === "Q3" || period === "Q4" ? "quarter" : "annual";
        const [growthData, keyMetricsData, profileData, balanceSheetGrowthData] = await Promise.all([
          fmp.growth(symbol, { period: growthPeriod, limit: 5 }),
          fmp.keyMetricsTTM(symbol),
          fmp.profile(symbol),
          fmp.balanceSheetGrowth(symbol, { period: "annual", limit: 5 }),
        ]);

        // Cashflow según periodo
        const cashflowPeriod: "annual" | "quarter" = period === "FY" || period === "annual" ? "annual" : "quarter";
        const cashflowLimit = cashflowPeriod === "quarter" ? 8 : 1;
        const cashflowData = await fmp.cashflow(symbol, { period: cashflowPeriod, limit: cashflowLimit });

        const g: FMPIncomeStatementGrowth[] = Array.isArray(growthData) ? growthData : [];
        const km: Partial<FMPKeyMetrics> = Array.isArray(keyMetricsData) && keyMetricsData.length ? keyMetricsData[0] : {};
        const cfItems: Partial<FMPCashFlowStatement>[] = Array.isArray(cashflowData) ? cashflowData : [];
        const p: Partial<FMPCompanyProfile> = Array.isArray(profileData) && profileData.length ? profileData[0] : {};
        const bsg: FMPBalanceSheetGrowth[] = Array.isArray(balanceSheetGrowthData) ? balanceSheetGrowthData : [];

        const roe = pctOrNull(r.returnOnEquity);
        const roic = pctOrNull(r.returnOnCapitalEmployed);
        const grossMargin = pctOrNull(r.grossProfitMargin);
        const netMargin = pctOrNull(r.netProfitMargin);
        const currentRatio = numOrNull(r.currentRatio);
        const interestCoverage = numOrNull(r.interestCoverage);

        // Deuda/Capital desde Deuda/Equity: D/(D+E) = (D/E)/(1 + D/E)
        const debtToEquity = numOrNull(r.debtEquityRatio);
        const debtToCapital = debtToEquity != null ? +(debtToEquity / (1 + debtToEquity)).toFixed(4) : null;

        // FCF según periodo seleccionado
        const fcfFromCashflow = (() => {
          if (!cfItems.length) return null;
          if (cashflowPeriod === "annual") {
            const item = cfItems[0];
            const fcf = numOrNull(item.freeCashFlow);
            const ocf = numOrNull(item.netCashProvidedByOperatingActivities ?? (item as any)?.operatingCashFlow);
            const capex = numOrNull(item.capitalExpenditure);
            return fcf != null ? fcf : ocf != null && capex != null ? +((ocf as number) - Math.abs(capex as number)).toFixed(2) : null;
          }
          // quarter: si Qx, tomar ese trimestre, si "quarter" genérico, sumar últimos 4
          if (period === "Q1" || period === "Q2" || period === "Q3" || period === "Q4") {
            const key = quarterMap[period];
            const q = cfItems.find((row: any) => String(row?.date ?? "").includes(key));
            if (!q) return null;
            const fcf = numOrNull(q.freeCashFlow);
            const ocf = numOrNull(q.netCashProvidedByOperatingActivities ?? (q as any)?.operatingCashFlow);
            const capex = numOrNull(q.capitalExpenditure);
            return fcf != null ? fcf : ocf != null && capex != null ? +((ocf as number) - Math.abs(capex as number)).toFixed(2) : null;
          }
          // quarter agregado: TTM por últimos 4
          const sum = cfItems.slice(-4).reduce((acc, item) => {
            const fcf = numOrNull(item.freeCashFlow);
            const ocf = numOrNull(item.netCashProvidedByOperatingActivities ?? (item as any)?.operatingCashFlow);
            const capex = numOrNull(item.capitalExpenditure);
            const calc = fcf != null ? fcf : ocf != null && capex != null ? (ocf as number) - Math.abs(capex as number) : null;
            return acc + (calc ?? 0);
          }, 0);
          return Number.isFinite(sum) && sum !== 0 ? +sum.toFixed(2) : null;
        })();

        const fcfFromKM = (() => {
          const fcfps = numOrNull(km.freeCashFlowPerShare);
          const shares = numOrNull(km.sharesOutstanding);
          return fcfps != null && shares != null ? +((fcfps as number) * (shares as number)).toFixed(2) : null;
        })();

        const fcfSelected = fcfFromCashflow ?? fcfFromKM;

        // Revenue aproximado desde P/S y market cap (según periodo)
        const ps = numOrNull(r.priceToSalesRatio);
        const marketCap = numOrNull(p.mktCap);
        const revenueApprox = marketCap != null && ps != null && ps > 0 ? +((marketCap as number) / (ps as number)).toFixed(2) : null;
        const freeCashFlowMarginPct = fcfSelected != null && revenueApprox != null && revenueApprox > 0 ? +(((fcfSelected as number) / (revenueApprox as number)) * 100).toFixed(2) : null;

        // CAGRs
        const revGrowthRates = g.map((item) => numOrNull(item.revenueGrowth) || 0);
        const epsGrowthRates = g.map((item) => numOrNull(item.epsgrowth) || 0);
        const equityGrowthRates = bsg.map((item) => numOrNull(item.growthTotalStockholdersEquity) || 0);
        const revCagr = cagrFromGrowthSeries(revGrowthRates);
        const epsCagr = cagrFromGrowthSeries(epsGrowthRates);
        const equityCagr = cagrFromGrowthSeries(equityGrowthRates);

        const bookValuePerShare = numOrNull(km.bookValuePerShare ?? (km as any).bookValuePerShareTTM);

        const build = (label: string, raw: number | null, unit?: "%" | "x" | "$") => {
          const meta = getScoreMeta(label, raw);
          const display = unit === "%" ? fmtPercent(raw) : unit === "x" ? fmtRatio(raw) : unit === "$" ? fmtLargeNumber(raw) : fmtRatio(raw);
          return { label, unit, raw, score: meta.score, target: meta.target, thresholds: meta.thresholds, display };
        };

        const metrics: MetricRow[] = [
          build("ROE", roe, "%"),
          build("ROIC", roic, "%"),
          build("Margen bruto", grossMargin, "%"),
          build("Margen neto", netMargin, "%"),
          build("Deuda/Capital", debtToCapital, "x"),
          build("Current Ratio", currentRatio, "x"),
          build("Cobertura de intereses", interestCoverage, "x"),
          build("Flujo de Caja Libre (%)", freeCashFlowMarginPct, "%"),
          build("CAGR ingresos", revCagr, "%"),
          build("CAGR beneficios", epsCagr, "%"),
          build("CAGR patrimonio", equityCagr, "%"),
          build("Book Value por acción", bookValuePerShare, "$"),
        ];

        setRows(metrics);

        // Persistir selección de periodo y fecha
        const updatedAt = (r as any)?.date ?? new Date().toISOString();
        savePeriodSelection(symbol, period, String(updatedAt)).catch(() => {});
      } catch (error) {
        console.error("Error fetching fundamental data:", error);
        setError("Error cargando datos fundamentales");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, localPeriod]);

  const option = useMemo(() => {
    const labels = rows.map((r) => r.label);
    const poor = rows.map((r) => r.thresholds.poor);
    const mid = rows.map((r) => Math.max(r.thresholds.avg - r.thresholds.poor, 0));
    const good = rows.map((r) => Math.max(100 - r.thresholds.avg, 0));
    const scores = rows.map((r) => (Number.isFinite(r.score as number) ? (r.score as number) : 0));

    // sin anidación extra
    const targets = rows.flatMap((r) =>
      r.target == null ? [] : [{ xAxis: r.target, yAxis: r.label }]
    );

    return {
      backgroundColor: "transparent",
      grid: { left: 170, right: 50, top: 10, bottom: 10 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "none" },
        backgroundColor: "rgba(248, 250, 252, 0.98)",
        borderColor: "rgba(203, 213, 225, 0.8)",
        borderWidth: 1,
        textStyle: { color: "#64748b", fontSize: 11 },
        confine: false, // Permite que el tooltip salga del contenedor
        appendToBody: true, // Renderiza el tooltip en el body del documento
        position: function (point: any, params: any, dom: any, rect: any, size: any) {
          // Posicionamiento inteligente para evitar que se corte
          return [point[0] + 10, point[1] - size.contentSize[1] / 2];
        },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          if (idx == null || !rows[idx]) return "";
          
          const row = rows[idx];
          const scoreTxt = row.score == null ? "Sin datos" : `${Math.round(row.score)} / 100`;
          const scoreColor = getScoreColor(row.score);
          const scoreLevel = getScoreLevel(row.score);
          
          return `
            <div style="max-width: 320px; padding: 12px; line-height: 1.4; background-color: rgba(248, 250, 252, 0.98); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #334155;">${row.label}</div>
              
              <div style="margin-bottom: 6px; font-size: 11px;">
                <span style="color: #64748b;">Valor:</span> 
                <span style="font-weight: 600; color: #475569;">${row.display}</span>
              </div>
              
              <div style="margin-bottom: 8px; font-size: 11px;">
                <span style="color: #64748b;">Score:</span> 
                <span style="font-weight: 600; color: ${scoreColor};">${scoreTxt}</span>
                <span style="margin-left: 6px; padding: 2px 6px; border-radius: 3px; font-size: 9px; background-color: ${scoreColor}15; color: ${scoreColor};">${scoreLevel}</span>
              </div>
            </div>`;
        },
      },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      yAxis: {
        type: "category",
        data: labels,
        axisLabel: { 
          color: "#e2e8f0",
          formatter: (value: string) => value // Mantener el texto original
        },
        axisTick: { show: false },
        axisLine: { show: false },
        triggerEvent: true // Habilitar eventos en el eje Y
      },
      series: [
        {
          name: "débil",
          type: "bar",
          stack: "range",
          data: poor,
          barWidth: 14,
          itemStyle: { color: "rgba(239,68,68,0.30)" },
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "medio",
          type: "bar",
          stack: "range",
          data: mid,
          barWidth: 14,
          itemStyle: { color: "rgba(234,179,8,0.30)" },
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "fuerte",
          type: "bar",
          stack: "range",
          data: good,
          barWidth: 14,
          itemStyle: { color: "rgba(34,197,94,0.30)" },
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "valor",
          type: "bar",
          data: scores,
          barWidth: 8,
          z: 5,
          itemStyle: { color: "#ffffff" },
          label: {
            show: true,
            position: "right",
            color: "#cbd5e1",
            formatter: (p: any) => rows[p.dataIndex]?.display ?? "",
          },
          markLine: {
            symbol: ["none", "none"],
            animation: false,
            label: { show: false },
            lineStyle: { color: "#ffffff", width: 1.5, opacity: 0.9 },
            data: targets,
          },
        },
      ],
    };
  }, [rows]);

  
    

    

  return (
    <>
      <Card className="bg-tarjetas border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-orange-400 text-lg flex gap-2 items-center">
            <div className="text-gray-400 mr-2">Datos Financieros</div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-400">Periodo</span>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Seleccionar periodo">
                {[
                  { label: "TTM", value: "ttm" },
                  { label: "FY", value: "FY" },
                  { label: "Q1", value: "Q1" },
                  { label: "Q2", value: "Q2" },
                  { label: "Q3", value: "Q3" },
                  { label: "Q4", value: "Q4" },
                  { label: "Anual", value: "annual" },
                  { label: "Trimestral", value: "quarter" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="tab"
                    aria-selected={localPeriod === (opt.value as PeriodSel)}
                    onClick={() => {
                      const next = opt.value as PeriodSel;
                      setLocalPeriod(next);
                      if (onPeriodChange) onPeriodChange(next);
                      savePeriodSelection(symbol, next, new Date().toISOString()).catch(() => {});
                    }}
                    className={[
                      "px-3 py-1 text-xs rounded transition-colors",
                      localPeriod === (opt.value as PeriodSel)
                        ? "bg-orange-500/20 text-orange-300"
                        : "text-gray-300 hover:bg-gray-700/40",
                    ].join(" ")}
                    title={opt.label}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-2">
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
                  // Función para obtener el color basado en el score
                  const getScoreColor = (score: number | null) => {
                    if (score === null || score === undefined) return "#64748b";
                    if (score >= 70) return "#22c55e"; // Verde para scores altos
                    if (score >= 40) return "#eab308"; // Amarillo para scores medios
                    return "#ef4444"; // Rojo para scores bajos
                  };

                  // Función para obtener el nivel del score
                  const getScoreLevel = (score: number | null) => {
                    if (score === null || score === undefined) return "Sin datos";
                    if (score >= 70) return "Fuerte";
                    if (score >= 40) return "A vigilar";
                    return "Débil";
                  };

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
        </CardContent>
      </Card>

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

                {/* Botón cerrar */}
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
