// components/cards/ValoracionCard.tsx
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

type Row = {
  label: string;
  raw: number | null;
  unit?: "%" | "x";
  score: number | null;
  thresholds: { poor: number; avg: number };
  display: string;
  target?: number | null;
};

const clamp = (x: number, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const ratioBetterLow = (x?: number | null, maxGood = 10, maxBad = 50) => {
  if (x == null) return null;
  const v = Math.min(Math.max(x, 0), maxBad);
  const score = ((maxBad - v) / (maxBad - maxGood)) * 100;
  return clamp(score);
};
const fmt = (v: number | null | undefined, unit?: "%" | "x") =>
  v == null ? "N/A" : unit === "%" ? `${v.toFixed(2)}%` : `${v.toFixed(2)}x`;

// Normalizaciones seguras (evita NaN/Infinity)
const numOrNull = (x: any): number | null => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

export default function ValoracionCard({ symbol }: { symbol: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const ratios = await fmp.ratios(symbol, { limit: 1, period: "annual" });
        const r = Array.isArray(ratios) && ratios.length ? ratios[0] : {};

        // Múltiplos base (normalizados)
        const pe = numOrNull(r?.priceEarningsRatio);
        const fwd = numOrNull(r?.forwardPE);
        const peg = numOrNull(r?.pegRatio);
        const pb = numOrNull(r?.priceToBookRatio);
        const ps = numOrNull(r?.priceToSalesRatio);
        const pfcf = numOrNull(r?.priceToFreeCashFlowsRatio ?? r?.priceToFreeCashFlowRatio);
        const evEbitda = numOrNull(r?.enterpriseValueMultiple);
        const evSales = numOrNull(r?.evToSales ?? r?.enterpriseValueToSales);
        const divYieldPct = (() => {
          const n = numOrNull(r?.dividendYield);
          return n == null ? null : n * 100; // FMP: 0.0123 => 1.23%
        })();

        // Precio y PT (robustos)
        const profileArr = await fmp.profile(symbol);
        const currentPrice = Array.isArray(profileArr) && profileArr.length ? numOrNull(profileArr[0]?.price) : null;

        const priceTarget =
          numOrNull(r?.targetMean) ??
          numOrNull(r?.targetMedian) ??
          numOrNull(r?.priceTargetAverage) ??
          numOrNull(r?.priceTarget) ??
          null;

        // Derivados SIN score
        // Crecimiento implícito (%) ≈ (PE_fwd || PE) / PEG
        const peForImplied = fwd ?? pe;
        const impliedGrowthPct =
          peForImplied != null && peg != null && peg > 0 ? peForImplied / peg : null;

        // Descuento vs. PT (%) = (PT - Precio) / Precio * 100
        const discountVsPTPct =
          currentPrice != null && currentPrice > 0 && priceTarget != null
            ? ((priceTarget - currentPrice) / currentPrice) * 100
            : null;

        const build = (
          label: string,
          val: number | null,
          unit?: "%" | "x",
          score?: number | null,
          thresholds?: { poor: number; avg: number }
        ): Row => ({
          label,
          raw: val,
          unit,
          score: score ?? null,
          thresholds: thresholds ?? { poor: 40, avg: 70 },
          display: fmt(val, unit),
        });

        const items: Row[] = [
          build("P/E (PER)", pe, "x", ratioBetterLow(pe, 12, 40)),
          build("P/E forward", fwd, "x", ratioBetterLow(fwd, 12, 40)),
          build("PEG", peg, "x", ratioBetterLow(peg, 1, 3)),
          build("P/Book (P/B)", pb, "x", ratioBetterLow(pb, 2, 6)),
          build("P/S (Ventas)", ps, "x", ratioBetterLow(ps, 2, 12)),
          build("P/FCF", pfcf, "x", ratioBetterLow(pfcf, 15, 40)),
          build("EV/EBITDA", evEbitda, "x", ratioBetterLow(evEbitda, 8, 25)),
          build("EV/Ventas", evSales, "x", ratioBetterLow(evSales, 2, 12)),
          build(
            "Dividend Yield",
            divYieldPct,
            "%",
            divYieldPct == null ? null : clamp((divYieldPct / 8) * 100),
            { poor: 10, avg: 30 }
          ),
          // Derivados (solo informativos, sin score)
          build("Crecimiento implícito", impliedGrowthPct, "%", null, { poor: 40, avg: 70 }),
          build("Descuento vs. PT", discountVsPTPct, "%", null, { poor: 40, avg: 70 }),
        ];

        if (alive) setRows(items);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Error cargando valoración");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [symbol]);

  const option = useMemo(() => {
    const labels = rows.map((r) => r.label);
    const poor = rows.map((r) => r.thresholds.poor);
    const mid = rows.map((r) => Math.max(r.thresholds.avg - r.thresholds.poor, 0));
    const good = rows.map((r) => Math.max(100 - r.thresholds.avg, 0));
    const scores = rows.map((r) => (Number.isFinite(r.score as number) ? (r.score as number) : 0));

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
        },
      ],
    };
  }, [rows]);

  return (
    <Card className="bg-tarjetas border-none h-[492px]">
      <CardHeader>
        <CardTitle className="text-orange-400 text-lg">Valoración — {symbol}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-gray-400">Cargando valoración…</div>
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
