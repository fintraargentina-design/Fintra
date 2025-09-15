// components/tabs/ChartsTabHistoricos.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { CandlestickChart, LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  BrushComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmp } from "@/lib/fmp/client";
import type { OHLC } from "@/lib/fmp/types";

echarts.use([
  CandlestickChart,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  BrushComponent,
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
  { key: "drawdown", label: "Drawdown" },
  { key: "rolling", label: "Rolling" },
  { key: "vol", label: "Volatilidad" },
  { key: "rel", label: "Relativo" },
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
        const [a, b] = await Promise.all([
          fmp.eod(symbol, { limit: 8000, cache: "no-store" }).then((r) => r.candles),
          showBenchmark
            ? fmp.eod(benchTicker, { limit: 8000, cache: "force-cache" }).then((r) => r.candles)
            : Promise.resolve([] as OHLC[]),
        ]);
        if (!alive) return;
        setPx(a);
        setBm(b);
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

  // 1) Precio (velas) + EMA50/200 + VWAP + Volumen - MEJORADO
  const optionCandles = React.useMemo(() => {
    const kline = dataR.map((d) => [d.open, d.close, d.low, d.high]);
    const upColor = '#00da3c';
    const downColor = '#ec0000';
    
    return {
      backgroundColor: "transparent",
      animation: false,
      legend: {
        bottom: 10,
        left: 'center',
        data: [symbol, 'EMA 50', 'EMA 200', 'VWAP'],
        textStyle: { color: "#9ca3af" }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        backgroundColor: 'rgba(245, 245, 245, 0.8)',
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        textStyle: {
          color: '#000'
        },
        position: function (pos: [number, number], params: any, el: HTMLElement, elRect: DOMRect, size: { viewSize: [number, number] }) {
          const obj: { top: number; [key: string]: number } = {
            top: 10
          };
          obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
          return obj;
        },
        formatter: function (param: any[]) {
          const data0 = param[0];
          if (!data0 || !data0.data) return '';
          
          const [open, close, low, high] = data0.data;
          const change = close - open;
          const changePercent = ((change / open) * 100).toFixed(2);
          const color = change >= 0 ? upColor : downColor;
          
          return [
            'Fecha: ' + data0.name + '<hr size=1 style="margin: 3px 0">',
            'Apertura: ' + open.toFixed(2),
            'Cierre: ' + close.toFixed(2),
            'Mínimo: ' + low.toFixed(2),
            'Máximo: ' + high.toFixed(2),
            `<span style="color: ${color}">Cambio: ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent}%)</span>`,
            'Volumen: ' + (volumes[data0.dataIndex] || 0).toLocaleString()
          ].join('<br/>');
        }
      },
      axisPointer: {
        link: [
          {
            xAxisIndex: 'all'
          }
        ],
        label: {
          backgroundColor: '#777'
        }
      },
      toolbox: {
        feature: {
          dataZoom: {
            yAxisIndex: false
          },
          brush: {
            type: ['lineX', 'clear']
          }
        }
      },
      brush: {
        xAxisIndex: 'all',
        brushLink: 'all',
        outOfBrush: {
          colorAlpha: 0.1
        }
      },
      grid: [
        {
          left: '10%',
          right: '8%',
          height: '50%'
        },
        {
          left: '10%',
          right: '8%',
          top: '63%',
          height: '16%'
        }
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { 
            onZero: false,
            lineStyle: { color: "#475569" }
          },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax',
          axisPointer: {
            z: 100
          },
          axisLabel: { color: "#cbd5e1" }
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          boundaryGap: false,
          axisLine: { onZero: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          min: 'dataMin',
          max: 'dataMax'
        }
      ],
      yAxis: [
        {
          scale: true,
          splitArea: {
            show: false
          },
          axisLabel: { color: "#cbd5e1" },
          splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } }
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 98,
          end: 100
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          top: '85%',
          start: 98,
          end: 100
        }
      ],
      series: [
        {
          name: symbol,
          type: 'candlestick',
          data: kline,
          itemStyle: {
            color: upColor,
            color0: downColor,
            borderColor: undefined,
            borderColor0: undefined
          },
          tooltip: {
            formatter: function (param) {
              const data = param.data;
              return [
                param.name + '<hr size=1 style="margin: 3px 0">',
                'Apertura: ' + data[0],
                'Cierre: ' + data[1],
                'Mínimo: ' + data[2],
                'Máximo: ' + data[3]
              ].join('<br>');
            }
          }
        },
        {
          name: 'EMA 50',
          type: 'line',
          data: ema50,
          smooth: true,
          lineStyle: {
            opacity: 0.5,
            width: 2,
            color: '#60a5fa'
          },
          showSymbol: false
        },
        {
          name: 'EMA 200',
          type: 'line',
          data: ema200,
          smooth: true,
          lineStyle: {
            opacity: 0.5,
            width: 2,
            color: 'purple'
          },
          showSymbol: false
        },
        {
          name: 'VWAP',
          type: 'line',
          data: vwap,
          smooth: true,
          lineStyle: {
            opacity: 0.7,
            width: 2,
            color: 'orange',
            type: 'dashed'
          },
          showSymbol: false
        },
        {
          name: 'Volumen',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes.map((vol, index) => {
            const isUp = kline[index] && kline[index][1] > kline[index][0];
            return {
              value: vol,
              itemStyle: {
                color: isUp ? upColor : downColor,
                opacity: 0.7
              }
            };
          })
        }
      ]
    };
  }, [dataR, dates, volumes, ema50, ema200, vwap, symbol]);

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
      dataZoom: [{ type: "inside" as const }, { type: "slider" as const, height: 18 }],
      series: [
        { name: `${symbol} DD%`, type: "line" as const, data: s, smooth: true, showSymbol: false, areaStyle: { opacity: 0.12 }, lineStyle: { color: "#ef4444" } },
        { name: "Benchmark DD%", type: "line" as const, data: b, smooth: true, showSymbol: false, areaStyle: { opacity: 0.08 }, lineStyle: { color: "#94a3b8" } },
      ],
    };
  }, [dataR, bmR, symbol]);

  // 3) Rolling returns 1/3/5Y (anualizados) + benchmark 1Y
  const rolling = React.useCallback((series: number[], win: number) => {
    const out = new Array(series.length).fill(NaN);
    for (let i = win - 1; i < series.length; i++) {
      const s0 = series[i - win + 1], s1 = series[i];
      const ret = s1 / s0 - 1;
      out[i] = Math.pow(1 + ret, 252 / win) - 1;
    }
    return out;
  }, []);
  const s1 = React.useMemo(() => rolling(closes, 252), [closes, rolling]);
  const s3 = React.useMemo(() => rolling(closes, 252 * 3), [closes, rolling]);
  const s5 = React.useMemo(() => rolling(closes, 252 * 5), [closes, rolling]);
  const bm1 = React.useMemo(() => rolling(bmR.map((d) => d.close), 252), [bmR, rolling]);

  const optionRolling = React.useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" as const, valueFormatter: (v: any) => `${(v * 100).toFixed(2)}%` },
    legend: { textStyle: { color: "#9ca3af" } },
    grid: { left: 55, right: 25, top: 20, bottom: 35 },
    xAxis: { type: "category" as const, data: dates, axisLabel: { color: "#cbd5e1" }, axisLine: { lineStyle: { color: "#475569" } } },
    yAxis: { type: "value" as const, axisLabel: { color: "#cbd5e1", formatter: (v: number) => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } } },
    dataZoom: [{ type: "inside" as const }, { type: "slider" as const, height: 18 }],
    series: [
      { name: "1Y", type: "line" as const, data: s1, showSymbol: false, lineStyle: { color: "#22c55e" } },
      { name: "3Y", type: "line" as const, data: s3, showSymbol: false, lineStyle: { color: "#60a5fa" } },
      { name: "5Y", type: "line" as const, data: s5, showSymbol: false, lineStyle: { color: "#facc15" } },
      { name: "Benchmark 1Y", type: "line" as const, data: bm1, showSymbol: false, lineStyle: { color: "#a78bfa" } },
    ],
  }), [dates, s1, s3, s5, bm1]);

  // 4) Volatilidad realizada 30/90d (anualizada)
  const daily = React.useMemo(() => {
    const arr: number[] = new Array(closes.length).fill(NaN);
    for (let i = 1; i < closes.length; i++) arr[i] = closes[i] / closes[i - 1] - 1;
    return arr;
  }, [closes]);
  const vol30 = React.useMemo(() => stdev(daily, 30).map((v) => v * Math.sqrt(252)), [daily]);
  const vol90 = React.useMemo(() => stdev(daily, 90).map((v) => v * Math.sqrt(252)), [daily]);

  const optionVol = React.useMemo(() => ({
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" as const, valueFormatter: (v: any) => `${(v * 100).toFixed(2)}%` },
    legend: { textStyle: { color: "#9ca3af" } },
    grid: { left: 55, right: 25, top: 20, bottom: 35 },
    xAxis: { type: "category" as const, data: dates, axisLabel: { color: "#cbd5e1" }, axisLine: { lineStyle: { color: "#475569" } } },
    yAxis: { type: "value" as const, axisLabel: { color: "#cbd5e1", formatter: (v: number) => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } } },
    dataZoom: [{ type: "inside" as const }, { type: "slider" as const, height: 18 }],
    series: [
      { name: "σ 30d", type: "line" as const, data: vol30, showSymbol: false, lineStyle: { color: "#ef4444" } },
      { name: "σ 90d", type: "line" as const, data: vol90, showSymbol: false, lineStyle: { color: "#94a3b8" } },
    ],
  }), [dates, vol30, vol90]);

  // 5) Performance relativa acumulada vs benchmark
  const optionRel = React.useMemo(() => {
    const mS = Object.fromEntries(dataR.map((d) => [d.date, d.close]));
    const mB = Object.fromEntries(bmR.map((d) => [d.date, d.close]));
    const common = Object.keys(mS).filter((d) => d in mB).sort();
    if (!common.length) return { xAxis: { data: [] }, series: [] };

    const s0 = mS[common[0]] || 1;
    const b0 = mB[common[0]] || 1;
    const s = common.map((d) => pct(mS[d] / s0 - 1));
    const b = common.map((d) => pct(mB[d] / b0 - 1));

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" as const, valueFormatter: (v: any) => `${(v).toFixed(2)}%` },
      legend: { textStyle: { color: "#9ca3af" } },
      grid: { left: 55, right: 25, top: 20, bottom: 35 },
      xAxis: { type: "category" as const, data: common, axisLabel: { color: "#cbd5e1" }, axisLine: { lineStyle: { color: "#475569" } } },
      yAxis: { type: "value" as const, axisLabel: { color: "#cbd5e1", formatter: "{value}%" }, splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } } },
      dataZoom: [{ type: "inside" as const }, { type: "slider" as const, height: 18 }],
      series: [
        { name: `${symbol} %`, type: "line" as const, data: s, showSymbol: false, lineStyle: { color: "#22c55e" } },
        { name: "Benchmark %", type: "line" as const, data: b, showSymbol: false, lineStyle: { color: "#f59e0b" } },
      ],
    };
  }, [dataR, bmR, symbol]);

  // Render del gráfico según tab
  const renderChart = () => {
    if (loading) {
      return <div className="h-[824px] animate-pulse bg-gray-800/40 rounded-md" />;
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
            style={{ height: 700, width: "100%" }}
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
            style={{ height: 856 }}
          />
        ) : (
          <div className="h-72 grid place-items-center text-gray-500 text-sm">
            Sin benchmark configurado
          </div>
        );
      case "rolling":
        return (
          <ReactECharts
            key={`roll-${symbol}-${range}`}
            echarts={echarts as any}
            option={optionRolling as any}
            notMerge
            lazyUpdate
            style={{ height: 856 }}
          />
        );
      case "vol":
        return (
          <ReactECharts
            key={`vol-${symbol}-${range}`}
            echarts={echarts as any}
            option={optionVol as any}
            notMerge
            lazyUpdate
            style={{ height: 856 }}
          />
        );
      case "rel":
        return bmR.length ? (
          <ReactECharts
            key={`rel-${symbol}-${range}`}
            echarts={echarts as any}
            option={optionRel as any}
            notMerge
            lazyUpdate
            style={{ height: 856 }}
          />
        ) : (
          <div className="h-72 grid place-items-center text-gray-500 text-sm">
            Sin benchmark configurado
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="bg-tarjetas border-none">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-blue-400 text-lg">
              Análisis Histórico — {companyName || "—"}{" "}
              <Badge variant="outline" className="ml-2 border-blue-500/50 text-blue-300">
                {symbol}
              </Badge>
            </CardTitle>

            {/* Rango */}
            <div className="flex gap-2 flex-wrap">
              {(["1A", "3A", "5A", "MAX"] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={[
                    "px-2 py-1 text-xs rounded border transition-colors",
                    range === r
                      ? "bg-orange-500/20 border-orange-400 text-orange-300"
                      : "bg-transparent border-gray-700 text-gray-300 hover:bg-gray-700/40",
                  ].join(" ")}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs de gráfico (como Dividendos) */}
          <div className="flex gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={[
                  "px-3 py-1 text-sm rounded transition-colors",
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
      </CardHeader>

      <CardContent>{renderChart()}</CardContent>
    </Card>
  );
}
