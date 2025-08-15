"use client";
import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { TooltipComponent, GridComponent, TitleComponent, DatasetComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { RawMetrics } from "@/lib/metricsNormalize";
import { normalizeMetrics } from "@/lib/metricsNormalize";

echarts.use([BarChart, TooltipComponent, GridComponent, TitleComponent, DatasetComponent, CanvasRenderer]);
const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

export default function MetricsBars({ raw, title = "Métricas normalizadas (0–100)" }:{
  raw: RawMetrics;
  title?: string;
}) {
  const scored = useMemo(() => normalizeMetrics(raw), [raw]);

  const labels = scored.map(s => s.label);
  const values = scored.map(s => (s.value ?? 0));

  const option = {
    backgroundColor: "transparent",
    title: { text: title, left: "center", textStyle: { color: "#e5e7eb", fontSize: 14 } },
    grid: { left: 160, right: 24, top: 32, bottom: 16 },
    tooltip: {
      formatter: (p:any) => {
        const idx = p.dataIndex;
        const v = scored[idx].value;
        return `<b>${labels[idx]}</b><br/>Score: ${v == null ? "N/A" : v.toFixed(0)}`;
      }
    },
    xAxis: {
      type: "value",
      min: 0, max: 100,
      axisLine: { lineStyle: { color: "#9ca3af" } },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
    },
    yAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: "#9ca3af" } },
      axisLabel: { color: "#cbd5e1" }
    },
    series: [{
      type: "bar",
      data: values,
      barWidth: 14,
      itemStyle: {
        color: (params:any) => {
          const v = values[params.dataIndex];
          // degradé simple según score
          if (v >= 70) return "#22c55e";
          if (v >= 40) return "#f59e0b";
          return "#ef4444";
        },
        borderRadius: [4, 4, 4, 4],
      },
      label: { show: true, position: "right", formatter: (p:any) => (values[p.dataIndex] ?? 0).toFixed(0), color: "#cbd5e1" },
    }]
  };

  return <ReactECharts echarts={echarts as any} option={option as any} style={{ height: 520, width: "100%" }} />;
}
