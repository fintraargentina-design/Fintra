// components/cards/FundamentalCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { fmp } from "@/lib/fmp/client";


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

// Diccionario de explicaciones para las métricas financieras
const METRIC_EXPLANATIONS: Record<string, string> = {
  "ROE": "Return on Equity - Mide la rentabilidad que obtienen los accionistas sobre su inversión. Un ROE alto indica que la empresa genera buenos beneficios con el capital de los accionistas.",
  "ROIC": "Return on Invested Capital - Evalúa la eficiencia con la que la empresa utiliza todo su capital invertido para generar beneficios. Es clave para valorar la calidad del negocio.",
  "Margen bruto": "Porcentaje de ingresos que queda después de descontar el costo directo de los productos vendidos. Un margen alto indica ventaja competitiva y poder de fijación de precios.",
  "Margen neto": "Porcentaje de ingresos que se convierte en beneficio neto después de todos los gastos. Refleja la eficiencia operativa y la rentabilidad final del negocio.",
  "Deuda/Capital": "Ratio que mide el nivel de endeudamiento respecto al capital total. Un ratio bajo indica menor riesgo financiero y mayor solidez del balance.",
  "Current Ratio": "Capacidad de la empresa para pagar sus deudas a corto plazo con sus activos corrientes. Un ratio entre 1.5-3 se considera saludable.",
  "Cobertura de intereses": "Número de veces que la empresa puede pagar los intereses de su deuda con sus beneficios. Un ratio alto indica menor riesgo de impago.",
  "Flujo de Caja Libre": "Dinero generado por las operaciones después de inversiones en capital. Es crucial para evaluar la capacidad de generar efectivo real.",
  "CAGR ingresos": "Tasa de crecimiento anual compuesta de los ingresos durante los últimos 5 años. Indica la consistencia del crecimiento del negocio.",
  "CAGR beneficios": "Tasa de crecimiento anual compuesta de los beneficios durante los últimos 5 años. Refleja la capacidad de convertir crecimiento en rentabilidad.",
  "CAGR patrimonio": "Tasa de crecimiento anual compuesta del patrimonio neto. Indica cómo crece el valor contable de la empresa para los accionistas.",
  "Book Value por acción": "Valor contable de la empresa dividido por el número de acciones. Representa el valor teórico de cada acción según los libros contables.",
  "Capitalización de Mercado": "Valor total de la empresa en el mercado (precio por acción × número de acciones). Refleja lo que los inversores están dispuestos a pagar por la empresa."
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
      return { score: inverseRatio(raw, 0.3, 1.5), target: inverseRatio(0.6, 0.3, 1.5), thresholds: { poor: 40, avg: 70 } };
    case "Current Ratio":
      return { score: sweetSpot(raw, 2, 1.5), target: sweetSpot(2, 2, 1.5), thresholds: { poor: 40, avg: 70 } };
    case "Cobertura de intereses":
      return { score: logSaturate(raw, 20), target: logSaturate(8, 20), thresholds: { poor: 40, avg: 70 } };
    case "Flujo de Caja Libre":
      return { score: null, target: null, thresholds: { poor: 40, avg: 70 } };
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

export default function FundamentalCard({ symbol }: { symbol: string }) {
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisModal, setAnalysisModal] = useState<AnalysisState>(initialAnalysisState);

  useEffect(() => {
    if (!symbol) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [ratiosData, growthData, keyMetricsData, cashflowData, profileData, balanceSheetGrowthData] = await Promise.all([
          fmp.ratios(symbol, { limit: 1, period: "annual" }),
          fmp.growth(symbol, { period: "annual", limit: 5 }),
          fmp.keyMetricsTTM(symbol),
          fmp.cashflow(symbol, { period: "annual", limit: 1 }),
          fmp.profile(symbol), // Agregar profile para obtener marketCap
          fmp.balanceSheetGrowth(symbol, { period: "annual", limit: 5 }), // Nueva llamada para CAGR patrimonio
        ]);

        // Procesar datos
        const r = Array.isArray(ratiosData) && ratiosData.length ? ratiosData[0] : {};
        const g = Array.isArray(growthData) ? growthData : [];
        const km = Array.isArray(keyMetricsData) && keyMetricsData.length ? keyMetricsData[0] : {};
        const cf = Array.isArray(cashflowData) && cashflowData.length ? cashflowData[0] : {};
        const p = Array.isArray(profileData) && profileData.length ? profileData[0] : {};
        const bsg = Array.isArray(balanceSheetGrowthData) ? balanceSheetGrowthData : []; // Datos de balance sheet growth

        // Normalizar valores
        const roe = pctOrNull(r.returnOnEquity);
        const roic = pctOrNull(r.returnOnCapitalEmployed);
        const grossMargin = pctOrNull(r.grossProfitMargin);
        const netMargin = pctOrNull(r.netProfitMargin);
        const debtToEquity = numOrNull(r.debtEquityRatio);
        const currentRatio = numOrNull(r.currentRatio);
        const interestCoverage = numOrNull(r.interestCoverage);
        const freeCashFlow = numOrNull(cf.freeCashFlow);
        
        // Calcular CAGRs de crecimiento
        const revGrowthRates = g.map((item, index) => {
          const rate = numOrNull(item.revenueGrowth);
          return rate || 0;
        });
        
        const epsGrowthRates = g.map((item, index) => {
          const rate = numOrNull(item.epsgrowth);
          return rate || 0;
        });
        
        const equityGrowthRates = bsg.map((item, index) => {
          const rate = numOrNull(item.growthTotalStockholdersEquity);
          return rate || 0;
        });
        
        const revCagr = cagrFromGrowthSeries(revGrowthRates);
        const epsCagr = cagrFromGrowthSeries(epsGrowthRates);
        const equityCagr = cagrFromGrowthSeries(equityGrowthRates);
        
        // Obtener bookValuePerShare de keyMetrics y marketCap de profile
        const bookValuePerShare = numOrNull(km.tangibleBookValuePerShareTTM);
        const marketCap = numOrNull(p.mktCap);

        // Función helper para construir filas
        const build = (label: string, raw: number | null, unit?: "% " | "x" | "$") => {
          const meta = getScoreMeta(label, raw);
          const display = unit === "%" ? fmtPercent(raw) : unit === "x" ? fmtRatio(raw) : unit === "$" ? fmtLargeNumber(raw) : fmtRatio(raw);
          return {
            label,
            unit,
            raw,
            score: meta.score,
            target: meta.target,
            thresholds: meta.thresholds,
            display,
          };
        };

        // Construir lista de métricas
        const metrics: MetricRow[] = [
          build("ROE", roe, "%"),
          build("ROIC", roic, "%"),
          build("Margen bruto", grossMargin, "%"),
          build("Margen neto", netMargin, "%"),
          build("Deuda/Capital", debtToEquity, "x"),
          build("Current Ratio", currentRatio, "x"),
          build("Cobertura de intereses", interestCoverage, "x"),
          build("Flujo de Caja Libre", freeCashFlow, "$"),
          build("CAGR ingresos", revCagr, "%"),
          build("CAGR beneficios", epsCagr, "%"),
          build("CAGR patrimonio", equityCagr, "%"),
          build("Book Value por acción", bookValuePerShare, "$"),
          build("Capitalización de Mercado", marketCap, "$"),
        ];

        setRows(metrics);
      } catch (error) {
        console.error("Error fetching fundamental data:", error);
        setError("Error cargando datos fundamentales");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

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
        axisLabel: { color: "#e2e8f0" },
        axisTick: { show: false },
        axisLine: { show: false },
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

  const handleAnalyzeWithAI = async () => {
    if (!rows.length) {
      console.warn('No hay datos para analizar');
      return;
    }

    // Abrir modal en estado de carga
    setAnalysisModal({
      isOpen: true,
      isLoading: true,
      data: null,
      error: null
    });

    try {
      // Preparar los datos en formato JSON para n8n
      const analysisData = {
        symbol,
        timestamp: new Date().toISOString(),
        chartType: 'fundamental',
        metrics: rows.map(row => ({
          label: row.label,
          value: row.raw,
          unit: row.unit,
          score: row.score,
          display: row.display,
          target: row.target,
          thresholds: row.thresholds,
          scoreLevel: getScoreLevel(row.score)
        })),
        summary: {
          totalMetrics: rows.length,
          validScores: rows.filter(r => r.score !== null).length,
          averageScore: rows.filter(r => r.score !== null).reduce((acc, r) => acc + (r.score || 0), 0) / rows.filter(r => r.score !== null).length || 0,
          strongMetrics: rows.filter(r => (r.score || 0) >= 70).length,
          weakMetrics: rows.filter(r => (r.score || 0) < 40).length
        }
      };

      console.log('📤 Enviando datos a n8n:', analysisData);

      // Enviar POST a n8n
      const response = await fetch('https://n8n.srv904355.hstgr.cloud/webhook/19d4e091-5368-4b5e-b4b3-71257abbd92d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisData)
      });

      if (!response.ok) {
        throw new Error(`Error en la respuesta: ${response.status}`);
      }

      const result: AnalysisResponse = await response.json();
      console.log('✅ Análisis recibido:', result);
      
      // Actualizar modal con los datos recibidos
      setAnalysisModal({
        isOpen: true,
        isLoading: false,
        data: result,
        error: null
      });
      
    } catch (error) {
      console.error('❌ Error enviando análisis a n8n:', error);
      setAnalysisModal({
        isOpen: true,
        isLoading: false,
        data: null,
        error: 'No se pudo analizar los datos fundamentales'
      });
    }
  };

  // Función para cerrar modal
  const closeModal = () => {
    setAnalysisModal(initialAnalysisState);
  };

  return (
    <>
      <Card className="bg-tarjetas border-none h-[492px]">
        <CardHeader>
          <CardTitle className="text-orange-400 text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="text-gray-400">
               Fundamental
              </div>
               {symbol}
            </div>
            <Button
              onClick={handleAnalyzeWithAI}
              disabled={loading || analysisModal.isLoading || !rows.length}
              size="sm"
              variant="outline"
              className="text-xs bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30 hover:border-blue-500/50 disabled:opacity-50"
            >
              {analysisModal.isLoading ? (
                <>
                  <div className="w-3 h-3 border border-blue-300 border-t-transparent rounded-full animate-spin mr-1" />
                  Analizando...
                </>
              ) : (
                'Analizar con IA'
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-72 flex items-center justify-center text-gray-400">
              Cargando fundamentales…
            </div>
          ) : error ? (
            <div className="h-72 flex items-center justify-center text-red-400">{error}</div>
          ) : (
            <>
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-500/50 rounded-sm" /> Débil
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 bg-yellow-500/50 rounded-sm" /> A vigilar
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-500/50 rounded-sm" /> Fuerte
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-[2px] h-3 bg-white inline-block" /> Target
                </span>
              </div>
              <ReactECharts
                echarts={echarts as any}
                option={option as any}
                notMerge
                lazyUpdate
                style={{ height: Math.max(260, rows.length * 28), width: "100%" }}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Análisis de IA */}
      {analysisModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* Header del modal */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {analysisModal.error ? 'Error' : 'Análisis Fundamental con IA'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido del modal */}
              {analysisModal.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <span className="ml-3 text-gray-400">Analizando datos fundamentales...</span>
                </div>
              ) : analysisModal.error ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-4">{analysisModal.error}</p>
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              ) : analysisModal.data ? (
                <div className="space-y-6">
                  {/* Impacto */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Impacto</h3>
                    <p className={`text-2xl font-bold ${getImpactColor(analysisModal.data.impacto)}`}>
                      {analysisModal.data.impacto}
                    </p>
                  </div>

                  {/* Análisis */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-2">Análisis</h3>
                    <p className="text-gray-300 leading-relaxed">
                      {analysisModal.data.analisis}
                    </p>
                  </div>

                  {/* Botón cerrar */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
