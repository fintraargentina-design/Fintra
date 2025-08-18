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

function cagrFromGrowthSeries(series: number[]): number | null {
  const valid = series.filter((x) => Number.isFinite(x));
  if (!valid.length) return null;
  const compounded = valid.reduce((acc, r) => acc * (1 + r), 1);
  return (Math.pow(compounded, 1 / valid.length) - 1) * 100;
}

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
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [ratios, growth] = await Promise.all([
          fmp.ratios(symbol, { limit: 1, period: "annual" }),
          fmp.growth(symbol, { limit: 5, period: "annual" }),
        ]);

        const r = Array.isArray(ratios) && ratios.length ? ratios[0] : {};
        const gArr = Array.isArray(growth) ? growth : [];

        const revenueCAGR = cagrFromGrowthSeries(gArr.slice(0, 5).map((g: any) => Number(g.growthRevenue ?? 0))) ?? null;
        const netIncomeCAGR = cagrFromGrowthSeries(
          gArr.slice(0, 5).map((g: any) => Number(g.growthNetIncome ?? g.growthOperatingIncome ?? g.growthEPS ?? 0))
        ) ?? null;
        const equityCAGR = cagrFromGrowthSeries(gArr.slice(0, 5).map((g: any) => Number(g.growthStockholdersEquity ?? 0))) ?? null;

        const vals = {
          roe: r.returnOnEquity != null ? Number(r.returnOnEquity) * 100 : null,
          roic: r.returnOnCapitalEmployed != null ? Number(r.returnOnCapitalEmployed) * 100 : null,
          grossMargin: r.grossProfitMargin != null ? Number(r.grossProfitMargin) * 100 : null,
          netMargin: r.netProfitMargin != null ? Number(r.netProfitMargin) * 100 : null,
          debtToEquity: r.debtEquityRatio != null ? Number(r.debtEquityRatio) : null,
          currentRatio: r.currentRatio != null ? Number(r.currentRatio) : null,
          interestCoverage: r.interestCoverage != null ? Number(r.interestCoverage) : null,
          freeCashFlow: null as number | null,
          revenueCAGR_5Y: revenueCAGR,
          netIncomeCAGR_5Y: netIncomeCAGR,
          equityCAGR_5Y: equityCAGR,
          bookValuePerShare: null as number | null,
          sharesOutstanding: null as number | null,
        };

        const build = (label: string, raw: number | null, unit?: "%" | "x" | "$"): MetricRow => {
          const meta = getScoreMeta(label, raw);
          const display =
            unit === "%"
              ? fmtPercent(raw)
              : unit === "x"
              ? `${fmtRatio(raw)}x`
              : unit === "$"
              ? raw == null ? "N/A" : `$${raw.toFixed(0)}`
              : raw == null ? "N/A" : String(raw);
          return { label, unit, raw, score: meta.score, target: meta.target, thresholds: meta.thresholds, display };
        };

        const list: MetricRow[] = [
          build("ROE", vals.roe, "%"),
          build("ROIC", vals.roic, "%"),
          build("Margen bruto", vals.grossMargin, "%"),
          build("Margen neto", vals.netMargin, "%"),
          build("Deuda/Capital", vals.debtToEquity, "x"),
          build("Current Ratio", vals.currentRatio, "x"),
          build("Cobertura de intereses", vals.interestCoverage, "x"),
          build("Flujo de Caja Libre", vals.freeCashFlow, "$"),
          build("CAGR ingresos", vals.revenueCAGR_5Y, "%"),
          build("CAGR beneficios", vals.netIncomeCAGR_5Y, "%"),
          build("CAGR patrimonio", vals.equityCAGR_5Y, "%"),
          build("Book Value por acción", vals.bookValuePerShare, "$"),
          build("Acciones en circulación", vals.sharesOutstanding),
        ];

        if (alive) setRows(list);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Error cargando fundamentales");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [symbol]);

  const option = useMemo(() => {
    const labels = rows.map((r) => r.label);
    const poor = rows.map((r) => r.thresholds.poor);
    const mid = rows.map((r) => Math.max(r.thresholds.avg - r.thresholds.poor, 0));
    const good = rows.map((r) => Math.max(100 - r.thresholds.avg, 0));
    const scores = rows.map((r) => (r.score == null ? 0 : r.score));
    const targets = rows
      .map((r) => (r.target == null ? null : [{ xAxis: r.target, yAxis: r.label }]))
      .filter(Boolean) as any[];

    return {
      backgroundColor: "transparent",
      grid: { left: 170, right: 120, top: 10, bottom: 10 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          const idx = params?.[params.length - 1]?.dataIndex ?? 0;
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
      xAxis: { type: "value", max: 100, axisLabel: { color: "#94a3b8" }, splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } } },
      yAxis: { type: "category", data: labels, axisLabel: { color: "#e2e8f0" }, axisTick: { show: false }, axisLine: { show: false } },
      series: [
        { name: "débil", type: "bar", stack: "range", data: poor, barWidth: 14, itemStyle: { color: "rgba(239,68,68,0.30)" }, emphasis: { disabled: true }, tooltip: { show: false } },
        { name: "medio", type: "bar", stack: "range", data: mid,  barWidth: 14, itemStyle: { color: "rgba(234,179,8,0.30)" }, emphasis: { disabled: true }, tooltip: { show: false } },
        { name: "fuerte",type: "bar", stack: "range", data: good, barWidth: 14, itemStyle: { color: "rgba(34,197,94,0.30)"  }, emphasis: { disabled: true }, tooltip: { show: false } },
        {
          name: "valor",
          type: "bar",
          data: scores,
          barWidth: 8,
          z: 5,
          itemStyle: { color: "#ffffff" },
          label: { show: true, position: "right", color: "#cbd5e1", formatter: (p: any) => rows[p.dataIndex]?.display ?? "" },
          markLine: { symbol: ["none", "none"], animation: false, label: { show: false }, lineStyle: { color: "#ffffff", width: 1.5, opacity: 0.9 }, data: targets },
        },
      ],
    };
  }, [rows]);

  return (
    <Card className="bg-tarjetas border-none h-[492px]">
      <CardHeader><CardTitle className="text-orange-400 text-lg">Fundamental — {symbol}</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">Cargando fundamentales…</div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-red-400">{error}</div>
        ) : (
          <>
            <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-red-500/50 rounded-sm" /> Débil</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500/50 rounded-sm" /> A vigilar</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-green-500/50 rounded-sm" /> Fuerte</span>
              <span className="inline-flex items-center gap-1"><span className="w-[2px] h-3 bg-white inline-block" /> Target</span>
            </div>
            <ReactECharts echarts={echarts as any} option={option as any} notMerge lazyUpdate style={{ height: Math.max(260, rows.length * 28), width: "100%" }} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
