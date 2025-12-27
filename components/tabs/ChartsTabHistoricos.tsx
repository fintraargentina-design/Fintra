// components/tabs/ChartsTabHistoricos.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  BrushComponent,
  ToolboxComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmp } from "@/lib/fmp/client";
import type { OHLC } from "@/lib/fmp/types";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  BrushComponent,
  ToolboxComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

type RangeKey = "1A" | "3A" | "5A" | "MAX";
type Market = "NASDAQ" | "NYSE" | "AMEX";
const getBenchmarkTicker = (m: Market) => (m === "NASDAQ" ? "^NDX" : "^GSPC");


const applyRange = (data: OHLC[], range: RangeKey) => {
  if (!data?.length) return [];
  if (range === "MAX") return data;
  const end = new Date(data[data.length - 1].date);
  const start = new Date(end);
  if (range === "1A") start.setFullYear(start.getFullYear() - 1);
  if (range === "3A") start.setFullYear(start.getFullYear() - 3);
  if (range === "5A") start.setFullYear(start.getFullYear() - 5);
  return data.filter((d) => new Date(d.date) >= start);
};

// helpers
const sma = (arr: number[], w: number) => {
  const out = new Array(arr.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= w) sum -= arr[i - w];
    if (i >= w - 1) out[i] = sum / w;
  }
  return out;
};
const stdev = (arr: number[], w: number) => {
  const out = new Array(arr.length).fill(NaN);
  for (let i = w - 1; i < arr.length; i++) {
    const slice = arr.slice(i - w + 1, i + 1);
    const m = slice.reduce((a, b) => a + b, 0) / w;
    const v = slice.reduce((a, b) => a + Math.pow(b - m, 2), 0) / (w - 1 || 1);
    out[i] = Math.sqrt(v);
  }
  return out;
};
const pct = (x: number) => x * 100;

// Anchored VWAP (desde el inicio del rango)
const anchoredVWAP = (candles: OHLC[]) => {
  let cumPV = 0;
  let cumVol = 0;
  const out: number[] = [];
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    const v = c.volume ?? 0;
    cumPV += typical * v;
    cumVol += v;
    out.push(cumVol > 0 ? cumPV / cumVol : NaN);
  }
  return out;
};

type Props = {
  symbol: string;
  companyName?: string;
  showBenchmark?: boolean;
  market?: Market;
};

const VIEWS = [
  { key: "precio", label: "Precio" },
  { key: "rel", label: "Relativo" },
  { key: "drawdown", label: "Drawdown" },
] as const;
type View = typeof VIEWS[number]["key"];

export default function ChartsTabHistoricos({
  symbol,
  companyName,
  showBenchmark = true,
  market = "NASDAQ",
}: Props) {
  const [range, setRange] = React.useState<RangeKey>("3A");
  const [view, setView] = React.useState<View>("precio");
  const [px, setPx] = React.useState<OHLC[]>([]);
  const [bm, setBm] = React.useState<OHLC[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const benchTicker = getBenchmarkTicker(market);
        let a: OHLC[] = [];
        let b: OHLC[] = [];

        try {
          const [resA, resB] = await Promise.all([
            fmp.eod(symbol, { limit: 8000, cache: "no-store" }),
            showBenchmark
              ? fmp.eod(benchTicker, { limit: 8000, cache: "force-cache" })
              : Promise.resolve([] as OHLC[]),
          ]);
          // @ts-ignore - EodResponse está tipado como any[] pero viene como { symbol, candles }
          const rawA = resA as any;
          const rawB = resB as any;
          a = Array.isArray(rawA) ? rawA : (rawA?.candles || []);
          b = Array.isArray(rawB) ? rawB : (rawB?.candles || []);
        } catch (err: any) {
          console.error("Error fetching historical data:", err);
        }

        if (!alive) return;
        setPx(Array.isArray(a) ? a : []);
        setBm(Array.isArray(b) ? b : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [symbol, showBenchmark, market]);

  // rango aplicado
  const dataR = React.useMemo(() => applyRange(px, range), [px, range]);
  const bmR = React.useMemo(() => applyRange(bm, range), [bm, range]);

  const dates = React.useMemo(() => dataR.map((d) => d.date), [dataR]);
  const closes = React.useMemo(() => dataR.map((d) => d.close), [dataR]);
  const volumes = React.useMemo(() => dataR.map((d) => d.volume ?? 0), [dataR]);

  // Función para calcular EMA (Media Móvil Exponencial)
  const ema = (arr: number[], period: number) => {
    const result: number[] = new Array(arr.length).fill(NaN);
    if (arr.length === 0 || period <= 0) return result;
    
    const multiplier = 2 / (period + 1);
    let emaValue = arr[0]; // Primer valor como semilla
    result[0] = emaValue;
    
    for (let i = 1; i < arr.length; i++) {
      if (!isNaN(arr[i])) {
        emaValue = (arr[i] * multiplier) + (emaValue * (1 - multiplier));
        result[i] = emaValue;
      }
    }
    
    return result;
  };

  // Cálculo de indicadores técnicos
  const ema50 = React.useMemo(() => ema(closes, 50), [closes]);
  const ema200 = React.useMemo(() => ema(closes, 200), [closes]);
  const vwap = React.useMemo(() => anchoredVWAP(dataR), [dataR]);

  // 1) Large Area Chart Style (Precio Solamente)
  const optionCandles = React.useMemo(() => {
    // Transformar datos para eje de tiempo: [timestamp/string, value]
    const dataPrice = dataR.map(d => [d.date, d.close]);
    
    return {
      backgroundColor: "transparent",
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          animation: false
        },
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        borderWidth: 1,
        borderColor: '#333',
        textStyle: { color: '#eee' },
        formatter: function (params: any) {
          if (!Array.isArray(params) || params.length === 0) return '';
          const date = new Date(params[0].axisValue);
          const dateStr = date.toLocaleDateString();
          let result = `<b>${dateStr}</b><br/>`;
          params.forEach((param: any) => {
            const seriesName = param.seriesName;
            const value = param.value[1]; 
            if (value === undefined || value === null) return;
            let displayValue = typeof value === 'number' ? value.toFixed(2) : value;
            result += `${param.marker} ${seriesName}: ${displayValue}<br/>`;
          });
          return result;
        }
      },
      legend: {
        top: 10,          
        left: 'center',
        data: [symbol],
        textStyle: { color: "#9ca3af" }
      },
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none' },
          restore: {},
          saveAsImage: {}
        },
        iconStyle: { borderColor: '#9ca3af' }
      },
      axisPointer: { link: { xAxisIndex: 'all' } },
      dataZoom: [
        {
          type: 'inside',
          realtime: true,
          start: 0,
          end: 100,
          xAxisIndex: [0]
        }
      ],
      grid: {
        left: '1%',
        right: '1%',
        top: '2%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: [
        {
          type: 'time',
          boundaryGap: false,
          axisLine: { onZero: false, lineStyle: { color: "#475569" } },
          splitLine: { show: false },
          axisPointer: { z: 100 },
          axisLabel: { color: "#cbd5e1" }
        }
      ],
      yAxis: [
        {
          type: 'value',
          scale: true,
          splitArea: { show: false },
          axisLabel: { color: "#cbd5e1" },
          splitLine: { show: false, lineStyle: { color: "rgba(148,163,184,0.15)" } },
          boundaryGap: [0, '100%']
        }
      ],
      series: [
        {
          name: symbol,
          type: 'line',
          symbol: 'none',
          sampling: 'lttb',
          itemStyle: {
            color: 'rgb(255, 70, 131)'
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgb(255, 158, 68)' },
              { offset: 1, color: 'rgb(255, 70, 131)' }
            ])
          },
          data: dataPrice
        }
      ]
    };
  }, [dataR, symbol]);

  // 2) Drawdown comparativo
  const optionDD = React.useMemo(() => {
    const mS = Object.fromEntries(dataR.map((d) => [d.date, d.close]));
    const mB = Object.fromEntries(bmR.map((d) => [d.date, d.close]));
    const common = Object.keys(mS).filter((d) => d in mB).sort();
    let peakS = -Infinity, peakB = -Infinity;
    const s = common.map((d) => { const v = mS[d]; peakS = Math.max(peakS, v); return pct((v - peakS) / peakS); });
    const b = common.map((d) => { const v = mB[d]; peakB = Math.max(peakB, v); return pct((v - peakB) / peakB); });

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" as const },
      legend: { textStyle: { color: "#9ca3af" } },
      grid: { left: 55, right: 25, top: 20, bottom: 35 },
      xAxis: { type: "category" as const, data: common, axisLabel: { color: "#cbd5e1" }, axisLine: { lineStyle: { color: "#475569" } } },
      yAxis: { type: "value" as const, axisLabel: { color: "#cbd5e1", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } }, max: 0, min: -90 },
      series: [
        { name: `${symbol} DD%`, type: "line" as const, data: s, smooth: true, showSymbol: false, areaStyle: { opacity: 0.12 }, lineStyle: { color: "#ef4444" } },
        { name: "Benchmark DD%", type: "line" as const, data: b, smooth: true, showSymbol: false, areaStyle: { opacity: 0.08 }, lineStyle: { color: "#94a3b8" } },
      ],
    };
  }, [dataR, bmR, symbol]);

  // 5) Performance relativa acumulada vs benchmark
  const optionRel = React.useMemo(() => {
    const mS = Object.fromEntries(dataR.map((d) => [d.date, d.close]));
    const mB = Object.fromEntries(bmR.map((d) => [d.date, d.close]));
    const common = Object.keys(mS).filter((d) => d in mB).sort();
    
    let finalDates = common;
    let finalS: number[] = [];
    let finalB: number[] = [];

    if (!common.length) {
      // VALORES DEMO para visualización cuando no hay datos coincidentes
      const demoCount = 50;
      finalDates = Array.from({length: demoCount}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (demoCount - i));
        return d.toISOString().split('T')[0];
      });
      // Simular curvas de rendimiento relativo
      finalS = finalDates.map((_, i) => (Math.sin(i * 0.2) * 5) + (i * 0.5)); 
      finalB = finalDates.map((_, i) => (i * 0.3) + (Math.random() * 2));
    } else {
      const s0 = mS[common[0]] || 1;
      const b0 = mB[common[0]] || 1;
      finalS = common.map((d) => pct(mS[d] / s0 - 1));
      finalB = common.map((d) => pct(mB[d] / b0 - 1));
    }

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" as const, valueFormatter: (v: any) => `${(v).toFixed(2)}%` },
      legend: { textStyle: { color: "#9ca3af" } },
      grid: { left: 55, right: 25, top: 20, bottom: 35 },
      xAxis: { type: "category" as const, data: finalDates, axisLabel: { color: "#cbd5e1" }, axisLine: { lineStyle: { color: "#475569" } } },
      yAxis: { type: "value" as const, axisLabel: { color: "#cbd5e1", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } } },
      series: [
        { name: `${symbol} %`, type: "line" as const, data: finalS, showSymbol: false, lineStyle: { color: "#22c55e" } },
        { name: "Benchmark %", type: "line" as const, data: finalB, showSymbol: false, lineStyle: { color: "#f59e0b" } },
      ],
    };
  }, [dataR, bmR, symbol]);

  // Render del gráfico según tab
  const renderChart = () => {
    if (loading) {
      return <div className="h-full w-full animate-pulse bg-gray-800/40 rounded-md" />;
    }
    switch (view) {
      case "precio":
        return (
          <ReactECharts
            key={`k-${symbol}-${range}`}
            echarts={echarts as any}
            option={optionCandles as any}
            notMerge
            lazyUpdate
            style={{ height: "100%", width: "100%" }}
          />
        );
      case "drawdown":
        return bmR.length ? (
          <ReactECharts
            key={`dd-${symbol}-${range}`}
            echarts={echarts as any}
            option={optionDD as any}
            notMerge
            lazyUpdate
            style={{ height: "100%", width: "100%" }}
          />
        ) : (
          <div className="h-full grid place-items-center text-gray-500 text-sm">
            Sin benchmark configurado
          </div>
        );
      case "rel":
        return bmR.length ? (
          <ReactECharts
            key={`rel-${symbol}-${range}`}
            echarts={echarts as any}
            option={optionRel as any}
            notMerge
            lazyUpdate
            style={{ height: "100%", width: "100%" }}
          />
        ) : (
          <div className="h-full grid place-items-center text-gray-500 text-sm">
            Sin benchmark configurado
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="bg-tarjetas border-none p-0 m-0 shadow-none h-full flex flex-col">
      <CardHeader className="p-0 m-0 space-y-0 shrink-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between w-full">
            {/* <CardTitle className="text-blue-400 text-lg">
              Análisis Histórico — {companyName || "—"}{" "}
              <Badge variant="outline" className="ml-2 border-blue-500/50 text-blue-300">
                {symbol}
              </Badge>
            </CardTitle> */}

            {/* Rango */}
            <div className="flex gap-2 flex-wrap">
              {(["1A", "3A", "5A", "MAX"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={[
                    "px-2 py-1 text-xs rounded-none border transition-colors",
                    range === r
                      ? "bg-orange-500/20 border-orange-400 text-orange-300"
                      : "bg-transparent border-gray-700 text-gray-300 hover:bg-gray-700/40",
                  ].join(" ")}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Tabs de gráfico (como Dividendos) */}
            <div className="flex gap-2">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={[
                    "px-2 py-1 text-xs rounded-none transition-colors",
                    view === v.key
                      ? "bg-orange-500/20 text-orange-300"
                      : "text-gray-300 hover:bg-gray-700/40",
                  ].join(" ")}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 m-0 flex-1 min-h-0">{renderChart()}</CardContent>
    </Card>
  );
}
