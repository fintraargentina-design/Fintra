// components/cards/FundamentalCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function FundamentalCard({ symbol }: { symbol: string }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[params.length - 1] : params;
          const idx = p?.dataIndex ?? 0;
          const row = rows[idx];
          const scoreTxt = row.score == null ? "Sin datos" : `${Math.round(row.score)} / 100`;
          return `
            <div style="min-width:220px">
              <div style="font-weight:600;margin-bottom:6px">${row.label}</div>
              <div>Valor: <b>${row.display}</b></div>
              <div>Score: <b>${scoreTxt}</b></div>
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

  return (
    <Card className="bg-tarjetas border-none h-[492px]">
      <CardHeader>
        <CardTitle className="text-orange-400 text-lg">Fundamental — {symbol}</CardTitle>
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
  );
}
