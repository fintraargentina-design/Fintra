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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { fmp } from "@/lib/fmp/client";
import type { OHLC } from "@/lib/fmp/types";
import { getBenchmarkTicker } from "@/lib/services/benchmarkService";
import { alignSeries, normalizeRebase100 } from "@/lib/utils/finance-math";

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

// Helper to filter data by range
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

// Colors for peers
const PEER_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f43f5e'];

type Props = {
  symbol: string;
  companyName?: string;
  showBenchmark?: boolean;
  comparedSymbols?: string[]; // Array of tickers
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
  comparedSymbols = [],
}: Props) {
  const { toast } = useToast();
  const [range, setRange] = React.useState<RangeKey>("3A");
  const [view, setView] = React.useState<View>("precio");
  
  // Store all data: Main Symbol, Benchmark, and Peers
  const [dataMap, setDataMap] = React.useState<Record<string, OHLC[]>>({});
  const [benchmarkTicker, setBenchmarkTicker] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  // 1. Determine Benchmark & Fetch All Data
  React.useEffect(() => {
    let alive = true;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // A. Determine Benchmark
        // We need profile to know exchange/sector, but for now we'll assume a default
        // or fetch profile if needed. Ideally passed or handled by service.
        // For this implementation, we'll try to get it via service if we had the profile,
        // but since we only have symbol, we'll fetch profile or use default.
        // Let's assume NASDAQ default if unknown, or rely on service logic.
        // The service `getBenchmarkTicker` might need a profile object or just ticker?
        // Let's check the service signature if I could... but I'll assume I need to fetch profile first.
        
        // Actually, let's fetch profile first to get accurate benchmark
        let profile: any = null;
        try {
          const profiles = await fmp.profile(symbol);
          profile = profiles?.[0];
        } catch (e) { console.warn("Profile fetch failed", e); }

        const bench = await getBenchmarkTicker(symbol, profile); // Should handle null profile gracefully
        setBenchmarkTicker(bench);

        // B. Prepare list of symbols to fetch
        const symbolsToFetch = new Set<string>([symbol]);
        if (showBenchmark && bench) symbolsToFetch.add(bench);
        comparedSymbols.forEach(s => symbolsToFetch.add(s));

        // C. Fetch in parallel
        const promises = Array.from(symbolsToFetch).map(async (ticker) => {
           try {
             const res = await fmp.eod(ticker, { limit: 8000 });
             // Handle array vs object response
             const data = Array.isArray(res) ? res : (res as any)?.historical || [];
             // Sort ascending
             return { ticker, data: data.reverse() }; 
           } catch (err) {
             console.error(`Error fetching ${ticker}`, err);
             return { ticker, data: [] };
           }
        });

        const results = await Promise.all(promises);
        
        if (!alive) return;

        const newDataMap: Record<string, OHLC[]> = {};
        results.forEach(({ ticker, data }) => {
          if (data.length === 0 && ticker !== symbol && ticker !== bench) {
             // Toast for missing peer data
             toast({
               variant: "destructive",
               title: "Datos no disponibles",
               description: `No se encontraron datos históricos para ${ticker}`
             });
          }
          newDataMap[ticker] = data;
        });

        setDataMap(newDataMap);

      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();

    return () => { alive = false; };
  }, [symbol, showBenchmark, comparedSymbols, toast]); // Re-fetch if comparison changes

  // 2. Prepare Data for Chart (Align & Filter)
  const chartData = React.useMemo(() => {
    const mainData = dataMap[symbol] || [];
    const benchData = benchmarkTicker ? (dataMap[benchmarkTicker] || []) : [];
    
    // Filter by Range first to reduce processing
    const mainR = applyRange(mainData, range);
    // For alignment, we need the date range of the MAIN symbol
    if (!mainR.length) return null;

    const peersData = comparedSymbols.map(s => ({
      symbol: s,
      data: dataMap[s] || []
    })).filter(p => p.data.length > 0);

    // Align all series to Main Symbol's dates
    // alignSeries signature: (main: OHLC[], others: { symbol: string, data: OHLC[] }[])
    // We pass the ALREADY FILTERED main data as the "master" timeline
    // But wait, alignSeries usually expects full history to find common start?
    // Actually, "alignSeries" in finance-math usually takes full arrays and returns aligned arrays.
    // Let's use the full arrays for alignment, THEN filter by range.
    
    // RE-THINK: If we filter Main by "1Y", we only want 1Y of peers.
    // So filtering first is correct for the X-axis (Date).
    // However, for "Relative" (Base 100), we need them to start at 100 at the beginning of the range.
    
    // Let's filter Main first.
    // Then filter others to match the start date of Main.
    
    const startDate = new Date(mainR[0].date);
    
    const filterByDate = (arr: OHLC[]) => arr.filter(d => new Date(d.date) >= startDate);
    
    const benchR = filterByDate(benchData);
    const peersR = peersData.map(p => ({
      symbol: p.symbol,
      data: filterByDate(p.data)
    }));

    // Now we have arrays covering the same time window (roughly).
    // We need to map them to the exact dates of mainR for ECharts "category" axis or use "time" axis.
    // ECharts "time" axis handles uneven dates well.
    
    return {
      main: mainR,
      benchmark: { symbol: benchmarkTicker, data: benchR },
      peers: peersR
    };
  }, [dataMap, symbol, benchmarkTicker, comparedSymbols, range]);

  // 3. Generate ECharts Options
  const getOption = React.useMemo(() => {
    if (!chartData || !chartData.main.length) return null;

    const { main, benchmark, peers } = chartData;
    const dates = main.map(d => d.date);

    // Common Grid & Tooltip
    const commonOptions = {
      backgroundColor: "transparent",
      animation: false,
      grid: { left: '1%', right: '5%', top: '5%', bottom: '10%', containLabel: true },
      dataZoom: [{ type: 'inside', realtime: true, start: 0, end: 100 }],
      legend: { 
        top: 'middle', 
        left: 'left', 
        orient: 'vertical', 
        textStyle: { color: "#9ca3af" },
        data: [symbol, benchmark.symbol, ...peers.map(p => p.symbol)].filter(Boolean)
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        borderColor: '#333',
        textStyle: { color: '#eee' },
        valueFormatter: (value: number) => value?.toFixed(2)
      },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#475569" } },
        axisLabel: { color: "#cbd5e1" },
        splitLine: { show: false }
      }
    };

    // Build Series based on View
    let series: any[] = [];
    let yAxis: any = {};

    if (view === "precio") {
      // Price View: Absolute values. Hard to compare if scales differ wildly.
      // Usually "Price" view only shows Main. Peers might be on secondary axis?
      // For simplicity in this requirement, "Comparación Dinámica" usually implies Relative view.
      // But if user wants Price, we just plot them.
      
      yAxis = { 
        type: 'value', 
        position: 'right', 
        scale: true,
        splitLine: { show: false, lineStyle: { color: "rgba(148,163,184,0.15)" } },
        axisLabel: { color: "#cbd5e1" }
      };

      // Main Series (Area)
      series.push({
        name: symbol,
        type: 'line',
        showSymbol: false,
        data: main.map(d => [d.date, d.close]),
        itemStyle: { color: '#FFA028' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#ffbf007c' },
            { offset: 1, color: '#cf72008a' }
          ])
        }
      });

      // Peers (Lines)
      peers.forEach((p, idx) => {
        series.push({
          name: p.symbol,
          type: 'line',
          showSymbol: false,
          data: p.data.map(d => [d.date, d.close]),
          itemStyle: { color: PEER_COLORS[idx % PEER_COLORS.length] },
          lineStyle: { width: 2 }
        });
      });

      // Benchmark (Dashed Line) - usually not shown in Price view unless requested?
      // User said "Comparación Dinámica", often implies Relative.
      // But let's include it if it exists.
      if (benchmark.data.length) {
         series.push({
          name: benchmark.symbol,
          type: 'line',
          showSymbol: false,
          data: benchmark.data.map(d => [d.date, d.close]),
          itemStyle: { color: '#6b7280' },
          lineStyle: { type: 'dashed', width: 2 }
        });
      }

    } else if (view === "rel") {
      // Relative Performance (Base 100)
      yAxis = {
        type: 'value',
        position: 'right',
        scale: true,
        axisLabel: { formatter: '{value}%', color: "#cbd5e1" },
        splitLine: { show: false }
      };

      // Normalize all
      const normMain = normalizeRebase100(main);
      const normBench = normalizeRebase100(benchmark.data);
      const normPeers = peers.map(p => ({ 
        symbol: p.symbol, 
        data: normalizeRebase100(p.data) 
      }));

      // Main
      series.push({
        name: symbol,
        type: 'line',
        showSymbol: false,
        data: normMain.map(d => [d.date, d.value]),
        itemStyle: { color: '#22c55e' }, // Green for relative
        lineStyle: { width: 2 }
      });

      // Benchmark
      if (normBench.length) {
        series.push({
          name: benchmark.symbol,
          type: 'line',
          showSymbol: false,
          data: normBench.map(d => [d.date, d.value]),
          itemStyle: { color: '#f59e0b' }, // Amber
          lineStyle: { width: 2, type: 'dashed' }
        });
      }

      // Peers
      normPeers.forEach((p, idx) => {
        series.push({
          name: p.symbol,
          type: 'line',
          showSymbol: false,
          data: p.data.map(d => [d.date, d.value]),
          itemStyle: { color: PEER_COLORS[idx % PEER_COLORS.length] },
          lineStyle: { width: 2 }
        });
      });

    } else if (view === "drawdown") {
      // Drawdown View
      yAxis = {
        type: 'value',
        position: 'right',
        max: 0,
        axisLabel: { formatter: '{value}%', color: "#cbd5e1" },
        splitLine: { show: false }
      };

      // Helper for DD
      const calcDD = (data: OHLC[]) => {
        let peak = -Infinity;
        return data.map(d => {
          peak = Math.max(peak, d.close);
          const dd = ((d.close - peak) / peak) * 100;
          return [d.date, dd];
        });
      };

      series.push({
        name: symbol,
        type: 'line',
        showSymbol: false,
        data: calcDD(main),
        itemStyle: { color: '#ef4444' },
        areaStyle: { opacity: 0.2 }
      });

      if (benchmark.data.length) {
        series.push({
          name: benchmark.symbol,
          type: 'line',
          showSymbol: false,
          data: calcDD(benchmark.data),
          itemStyle: { color: '#94a3b8' },
          lineStyle: { type: 'dashed' },
          areaStyle: { opacity: 0.1 }
        });
      }
      
      // Peers Drawdown? Maybe too messy. Let's include them but thin.
      peers.forEach((p, idx) => {
        series.push({
          name: p.symbol,
          type: 'line',
          showSymbol: false,
          data: calcDD(p.data),
          itemStyle: { color: PEER_COLORS[idx % PEER_COLORS.length] },
          lineStyle: { width: 1, opacity: 0.7 }
        });
      });
    }

    return {
      ...commonOptions,
      yAxis,
      series
    };
  }, [chartData, view, symbol, benchmarkTicker, comparedSymbols]);

  const renderChart = () => {
    if (loading) return <div className="h-full w-full animate-pulse bg-zinc-900/50 rounded-md" />;
    if (!getOption) return <div className="h-full grid place-items-center text-zinc-500">Sin datos</div>;

    return (
      <ReactECharts
        key={`${symbol}-${view}-${range}-${comparedSymbols.join('-')}`} // Force remount on major changes
        echarts={echarts as any}
        option={getOption}
        notMerge
        lazyUpdate
        style={{ height: "100%", width: "100%" }}
      />
    );
  };

  return (
    <Card className="bg-tarjetas border-none p-0 m-0 shadow-none h-full flex flex-col">
      <CardHeader className="p-0 m-0 space-y-0 shrink-0 w-full border-b border-zinc-800 bg-transparent z-10">
        <div className="flex items-center justify-between w-full">
          {/* Range Selectors */}
          <div className="flex gap-0.5 flex-wrap">
            {(["1A", "3A", "5A", "MAX"] as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`
                  rounded-none border-b-2 px-2 py-1 text-xs transition-colors font-medium
                  ${
                    range === r
                      ? 'bg-[#0056FF] text-white border-[#0056FF]'
                      : 'bg-zinc-900 border-black text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                  }
                `}
              >
                {r}
              </button>
            ))}
          </div>

          {/* View Selectors */}
          <div className="flex gap-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className={`
                  rounded-none border-b-2 px-2 py-1 text-xs transition-colors font-medium
                  ${
                    view === v.key
                      ? 'bg-[#0056FF] text-white border-[#0056FF]'
                      : 'bg-zinc-900 border-black text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                  }
                `}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 m-0 flex-1 min-h-0 relative">
        {renderChart()}
      </CardContent>
    </Card>
  );
}
