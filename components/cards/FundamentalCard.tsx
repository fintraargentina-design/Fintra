// components/cards/FundamentalCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmp } from "@/lib/fmp/client"; // <-- cliente que llama a /api/fmp

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), {
  ssr: false,
});

/* ────────────────────────────────────────────
   Utils de normalización / formatos (0–100)
   ──────────────────────────────────────────── */
const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const pctCap = (x?: number | null, cap = 40) =>
  x == null ? null : clamp((Math.max(x, 0) / cap) * 100);
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
const linearCap = (x?: number | null, cap = 60) =>
  x == null ? null : clamp((x / cap) * 100);

const fmtPercent = (v?: number | null, d = 1) =>
  v == null ? "N/A" : `${v.toFixed(d)}%`;
const fmtRatio = (v?: number | null, d = 2) =>
  v == null ? "N/A" : v.toFixed(d);

/* Para growth anual FMP (viene en decimales: 0.10 = 10%) */
function cagrFromGrowthSeries(series: number[]): number | null {
  const valid = series.filter((x) => Number.isFinite(x));
  if (!valid.length) return null;
  // aproximación simple: media geométrica de tasas
  const compounded = valid.reduce((acc, r) => acc * (1 + r), 1);
  const cagr = Math.pow(compounded, 1 / valid.length) - 1;
  return cagr * 100;
}

/* ────────────────────────────────────────────
   Tipos & mapeo de scores/targets
   ──────────────────────────────────────────── */
type MetricRow = {
  label: string;
  unit?: "%" | "x" | "$";
  raw: number | null;
  score: number | null; // 0..100
  target: number | null;
  thresholds: { poor: number; avg: number }; // en 0..100
  display: string; // texto bonito a la derecha
};

function getScoreMeta(label: string, raw: number | null) {
  switch (label) {
    case "ROE":
      return {
        score: pctCap(raw, 40),
        target: (15 / 40) * 100,
        thresholds: { poor: (10 / 40) * 100, avg: (20 / 40) * 100 },
      };
    case "ROIC":
      return {
        score: pctCap(raw, 40),
        target: (12 / 40) * 100,
        thresholds: { poor: (8 / 40) * 100, avg: (15 / 40) * 100 },
      };
    case "Margen bruto":
      return {
        score: pctCap(raw, 80),
        target: (40 / 80) * 100,
        thresholds: { poor: (25 / 80) * 100, avg: (35 / 80) * 100 },
      };
    case "Margen neto":
      return {
        score: pctCap(raw, 30),
        target: (15 / 30) * 100,
        thresholds: { poor: (7 / 30) * 100, avg: (12 / 30) * 100 },
      };
    case "Deuda/Capital":
      return {
        score: inverseRatio(raw, 0.3, 1.5),
        target: inverseRatio(0.6, 0.3, 1.5),
        thresholds: { poor: 40, avg: 70 },
      };
    case "Current Ratio":
      return {
        score: sweetSpot(raw, 2, 1.5),
        target: sweetSpot(2, 2, 1.5),
        thresholds: { poor: 40, avg: 70 },
      };
    case "Cobertura de intereses":
      return {
        score: logSaturate(raw, 20),
        target: logSaturate(8, 20),
        thresholds: { poor: 40, avg: 70 },
      };
    case "Flujo de Caja Libre":
      // si no tenemos monto, dejamos “sin datos”
      return { score: null, target: null, thresholds: { poor: 40, avg: 70 } };
    case "CAGR ingresos":
      return {
        score: pctCap(raw, 30),
        target: (10 / 30) * 100,
        thresholds: { poor: (5 / 30) * 100, avg: (12 / 30) * 100 },
      };
    case "CAGR beneficios":
      return {
        score: pctCap(raw, 40),
        target: (15 / 40) * 100,
        thresholds: { poor: (8 / 40) * 100, avg: (20 / 40) * 100 },
      };
    case "CAGR patrimonio":
      return {
        score: pctCap(raw, 25),
        target: (10 / 25) * 100,
        thresholds: { poor: (5 / 25) * 100, avg: (12 / 25) * 100 },
      };
    case "Book Value por acción":
      return {
        score: linearCap(raw, 60),
        target: (20 / 60) * 100,
        thresholds: { poor: (10 / 60) * 100, avg: (30 / 60) * 100 },
      };
    case "Acciones en circulación":
      // sin key-metrics no lo tenemos fiable; dejar N/A
      return { score: null, target: null, thresholds: { poor: 40, avg: 70 } };
    default:
      return { score: null, target: null, thresholds: { poor: 40, avg: 70 } };
  }
}

/* ────────────────────────────────────────────
   Props
   ──────────────────────────────────────────── */
interface FundamentalCardProps {
  /** Symbol a consultar en FMP (ej: "AAPL"). */
  symbol: string;
}

/* ────────────────────────────────────────────
   Componente principal
   ──────────────────────────────────────────── */
export default function FundamentalCard({ symbol }: FundamentalCardProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // fetch FMP (ratios + growth + profile como apoyo)
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [ratiosRes, growthRes, profileRes] = await Promise.allSettled([
          fmp.ratios(symbol),
          fmp.growth(symbol),
          fmp.profile(symbol),
        ]);

        // ratios (tomamos el más reciente)
        const ratios =
          ratiosRes.status === "fulfilled" && Array.isArray(ratiosRes.value) && ratiosRes.value.length
            ? ratiosRes.value[0]
            : {};

        // growth (serie anual, tomamos últimos 5 puntos)
        const growthArr =
          growthRes.status === "fulfilled" && Array.isArray(growthRes.value)
            ? growthRes.value
            : [];

        const revenueCAGR =
          cagrFromGrowthSeries(
            growthArr.slice(0, 5).map((g: any) => Number(g.growthRevenue ?? 0))
          ) ?? null;

        // FMP a veces trae EPS o NetIncome; probamos ambos
        const netIncomeCAGR =
          cagrFromGrowthSeries(
            growthArr.slice(0, 5).map((g: any) =>
              Number(
                g.growthNetIncome ??
                  g.growthOperatingIncome ??
                  g.growthEPS ??
                  0
              )
            )
          ) ?? null;

        const equityCAGR =
          cagrFromGrowthSeries(
            growthArr.slice(0, 5).map((g: any) =>
              Number(g.growthStockholdersEquity ?? 0)
            )
          ) ?? null;

        // profile por si a futuro tomamos image/bvps/shares — no bloquea
        const profile =
          profileRes.status === "fulfilled" && Array.isArray(profileRes.value) && profileRes.value.length
            ? profileRes.value[0]
            : {};

        // Mapear a filas (con %*100 donde aplique: FMP ratios trae márgenes en decimales)
        const vals = {
          roe: ratios.returnOnEquity != null ? Number(ratios.returnOnEquity) * 100 : null,
          roic:
            ratios.returnOnCapitalEmployed != null
              ? Number(ratios.returnOnCapitalEmployed) * 100
              : null,
          grossMargin:
            ratios.grossProfitMargin != null
              ? Number(ratios.grossProfitMargin) * 100
              : null,
          netMargin:
            ratios.netProfitMargin != null
              ? Number(ratios.netProfitMargin) * 100
              : null,
          debtToEquity:
            ratios.debtEquityRatio != null ? Number(ratios.debtEquityRatio) : null,
          currentRatio:
            ratios.currentRatio != null ? Number(ratios.currentRatio) : null,
          interestCoverage:
            ratios.interestCoverage != null ? Number(ratios.interestCoverage) : null,
          // FCF absoluto: necesitaríamos /key-metrics o /cash-flow; de momento N/A
          freeCashFlow: null as number | null,
          revenueCAGR_5Y: revenueCAGR,
          netIncomeCAGR_5Y: netIncomeCAGR,
          equityCAGR_5Y: equityCAGR,
          // Sin key-metrics dejamos N/A estas dos:
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
              ? (raw == null ? "N/A" : `$${raw.toFixed(0)}`)
              : raw == null
              ? "N/A"
              : String(raw);
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
    }

    load();
    return () => {
      alive = false;
    };
  }, [symbol]);

  /* ECharts: un solo gráfico tipo “bullet list”
     - 3 series apiladas (rangos rojo/amarillo/verde)
     - 1 serie medida (valor actual)
     - markLine por fila para el target
  */
  const option = useMemo(() => {
    const labels = rows.map((r) => r.label);

    const poor = rows.map((r) => r.thresholds.poor);
    const mid = rows.map((r) => Math.max(r.thresholds.avg - r.thresholds.poor, 0));
    const good = rows.map((r) => Math.max(100 - r.thresholds.avg, 0));

    const scores = rows.map((r) => (r.score == null ? 0 : r.score));

    const targets = rows
      .map((r, idx) =>
        r.target == null
          ? null
          : [
              {
                xAxis: r.target,
                yAxis: r.label, // categoría
              },
            ]
      )
      .filter(Boolean) as any[];

    return {
      backgroundColor: "transparent",
      grid: { left: 170, right: 120, top: 10, bottom: 10 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: any) => {
          // params es array con las 4 series; usamos el índice para mapear
          const idx = params?.[params.length - 1]?.dataIndex ?? 0;
          const row = rows[idx];
          const scoreTxt =
            row.score == null ? "Sin datos" : `${Math.round(row.score)} / 100`;
          return `
            <div style="min-width:220px">
              <div style="font-weight:600;margin-bottom:6px">${row.label}</div>
              <div>Valor: <b>${row.display}</b></div>
              <div>Score: <b>${scoreTxt}</b></div>
            </div>
          `;
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
        // rangos
        {
          name: "débil",
          type: "bar",
          stack: "range",
          data: poor,
          barWidth: 14,
          itemStyle: { color: "rgba(239,68,68,0.30)" }, // red-500/30
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "medio",
          type: "bar",
          stack: "range",
          data: mid,
          barWidth: 14,
          itemStyle: { color: "rgba(234,179,8,0.30)" }, // yellow-500/30
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        {
          name: "fuerte",
          type: "bar",
          stack: "range",
          data: good,
          barWidth: 14,
          itemStyle: { color: "rgba(34,197,94,0.30)" }, // green-500/30
          emphasis: { disabled: true },
          tooltip: { show: false },
        },
        // medida
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
    <Card className="bg-tarjetas border-orange-500/30">
      <CardHeader>
        <CardTitle className="text-orange-400 text-lg">
          Fundamental — {symbol}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">
            Cargando fundamentales…
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center text-red-400">
            {error}
          </div>
        ) : (
          <>
            {/* Leyenda compacta */}
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
