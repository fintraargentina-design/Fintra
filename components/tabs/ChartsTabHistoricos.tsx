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
import { alignSeries, normalizeRebase100, calculateDrawdown } from "@/lib/utils/finance-math";

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
const PEER_COLORS = ['#0056FF'];

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

const INDEX_NAMES: Record<string, string> = {
  '^GSPC': 'S&P 500',
  '^IXIC': 'Nasdaq',
  '^DJI': 'Dow Jones',
  '^GSPTSE': 'S&P/TSX',
  '^FTSE': 'FTSE 100',
  '^GDAXI': 'DAX',
  '^FCHI': 'CAC 40',
  '^SSMI': 'SMI',
  '^AEX': 'AEX',
  '^N225': 'Nikkei 225',
  '^HSI': 'Hang Seng',
  '000001.SS': 'SSE Composite',
  '^BSESN': 'BSE SENSEX',
  '^AXJO': 'ASX 200',
  '^BVSP': 'IBOVESPA',
  'BTCUSD': 'Bitcoin',
  'EURUSD': 'EUR/USD',
  '^RUT': 'Russell 2000',
  '^VIX': 'VIX',
  '^TNX': '10-Year Treasury',
};

const getLabel = (symbol: string) => INDEX_NAMES[symbol] || symbol;

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
  const [error, setError] = React.useState<string | null>(null);

  // 1. Determine Benchmark & Fetch All Data
  React.useEffect(() => {
    let alive = true;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      if (!symbol) {
        if (alive) {
          setLoading(false);
          setError("Símbolo no especificado");
        }
        return;
      }

      try {
        // A. Determine Benchmark
        let profile: any = null;
        try {
          const profiles = await fmp.profile(symbol);
          profile = profiles?.[0];
        } catch (e) { console.warn("Profile fetch failed", e); }

        let bench = "";
        try {
          bench = await getBenchmarkTicker(symbol, profile); 
        } catch (e) {
          console.warn("Benchmark error", e);
        }
        if (alive) setBenchmarkTicker(bench);

        // B. Prepare list of symbols to fetch
        const symbolsToFetch = new Set<string>([symbol]);
        if (showBenchmark && bench) symbolsToFetch.add(bench);
        comparedSymbols.forEach(s => symbolsToFetch.add(s));

        // C. Fetch in parallel
        const promises = Array.from(symbolsToFetch).map(async (ticker) => {
           try {
             // Fetch limit depends on range, but fetching enough for 5Y+ is safe
             const res = await fmp.eod(ticker, { limit: 8000 });

             console.log(`[ChartsTab] Raw API response for ${ticker}:`, res);
             if (res && typeof res === 'object') {
                 console.log(`[ChartsTab] Response keys for ${ticker}:`, Object.keys(res));
             }
             
             // --- FIX: Map response to OHLC[] explicitly ---
             let data: OHLC[] = [];
             if (Array.isArray(res)) {
                 data = res as unknown as OHLC[];
             } else if ((res as any)?.candles) {
                 // New internal API format returns { symbol: '...', candles: [...] }
                 data = (res as any).candles;
             } else if ((res as any)?.historical) {
                 // Old FMP format
                 data = (res as any).historical;
             }

             console.log(`[ChartsTab] Parsed data for ${ticker}: ${data.length} records.`);
             if (data.length > 0) {
                 console.log(`[ChartsTab] First item for ${ticker}:`, data[0]);
             } else {
                 console.warn(`[ChartsTab] No records parsed for ${ticker}. Raw res:`, res);
             }
             
             // Sort ascending (oldest first) if needed
             // Check if already sorted by date ascending
             if (data.length > 1) {
                const d1 = new Date(data[0].date).getTime();
                const d2 = new Date(data[data.length-1].date).getTime();
                if (d1 > d2) {
                    data.reverse();
                }
             }

             return { ticker, data }; 
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
             toast({
               variant: "destructive",
               title: "Datos no disponibles",
               description: `No se encontraron datos históricos para ${ticker}`
             });
          }
          newDataMap[ticker] = data;
        });

        // Check if main symbol has data
      if (!newDataMap[symbol] || newDataMap[symbol].length === 0) {
        console.warn(`[ChartsTab] No data found for main symbol: ${symbol}. Check API response.`);
        console.log(`[ChartsTab] Full results keys: ${results.map(r => r.ticker).join(', ')}`);
        results.forEach(r => console.log(`[ChartsTab] ${r.ticker}: ${r.data.length} records`));
        setError(`No hay datos históricos disponibles para ${symbol}`);
      } else {
        setDataMap(newDataMap);
      }

      } catch (err) {
        console.error("[ChartsTab] Critical error in fetchData:", err);
        setError("Error inesperado al cargar datos");
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();

    return () => { alive = false; };
  }, [symbol, showBenchmark, comparedSymbols, toast]);

  // 2. Prepare Data for Chart (Align & Filter)
  const chartData = React.useMemo(() => {
    const mainData = dataMap[symbol] || [];

    if (mainData.length > 0) {
      // no-op
    }
    
    // Filter Main by Range first
    const mainR = applyRange(mainData, range);

    if (!mainR.length) {
      return null;
    }

    // Start Date for filtering others
    const startDate = new Date(mainR[0].date);
    const filterByDate = (arr: OHLC[]) => arr.filter(d => new Date(d.date) >= startDate);

    // Prepare other series list for alignment
    const otherSeriesList: { id: string; data: OHLC[] }[] = [];

    // Add Benchmark
    if (benchmarkTicker && dataMap[benchmarkTicker]?.length) {
      otherSeriesList.push({ 
        id: benchmarkTicker, 
        data: filterByDate(dataMap[benchmarkTicker]) 
      });
    }

    // Add Peers
    comparedSymbols.forEach(s => {
      if (dataMap[s]?.length) {
        otherSeriesList.push({ id: s, data: filterByDate(dataMap[s]) });
      }
    });

    return {
      main: mainR,
      others: otherSeriesList
    };
  }, [dataMap, symbol, benchmarkTicker, comparedSymbols, range]);

  // 3. Generate ECharts Options
  const getOption = React.useMemo(() => {
    if (!chartData) {
      console.log("[ChartsTab] getOption: chartData is null");
      return null;
    }

    const { main, others } = chartData;
    console.log(`[ChartsTab] getOption: Aligning ${main.length} main points with ${others.length} other series`);

    // --- PASO CRÍTICO: ALINEACIÓN ---
    // alignSeries ahora usa la UNIÓN de fechas y maneja gaps correctamente.
    const aligned = alignSeries(main, others);

    // Lista de claves (IDs) en el objeto alineado, excluyendo 'date' y 'primary'
    const otherKeys = others.map(o => o.id);
    const allKeys = ['primary', ...otherKeys];

    // Tooltip Formatter para manejar gaps y nulls
    const tooltipFormatter = (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const date = params[0].axisValue;
        let str = `<div style="font-weight:bold;margin-bottom:4px;color:#fff">${date}</div>`;
        params.forEach((p: any) => {
            const val = p.value;
            // Solo mostrar si el valor es válido
            if (val !== null && val !== undefined && val !== "" && !Number.isNaN(Number(val))) {
                str += `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px">
                          <span style="color:${p.color}">${p.seriesName}</span>
                          <span style="font-weight:bold;color:#fff">${typeof val === 'number' ? val.toFixed(2) : val}%</span>
                        </div>`;
            }
        });
        return str;
    };

    // Common Options
    const commonOptions = {
      backgroundColor: "transparent",
      animation: false,
      grid: { left: '1%', right: '5%', top: '5%', bottom: '12%', containLabel: true },
      dataZoom: [{ type: 'inside', realtime: true, start: 0, end: 100 }],
      toolbox: {
        feature: {
          saveAsImage: {
            title: "Guardar imagen",
            backgroundColor: "#141414",
            pixelRatio: 2
          }
        },
        iconStyle: {
          borderColor: "#9ca3af"
        },
        right: -8,
        top: 0
      },
      legend: { 
        bottom: 0, 
        left: 'center', 
        orient: 'horizontal', 
        icon: 'rect',
        itemHeight: 2,
        itemWidth: 12,
        textStyle: { color: "#9ca3af" },
        // Mapeamos 'primary' al símbolo real para la leyenda
        data: [getLabel(symbol), ...otherKeys.map(getLabel)] 
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        borderColor: '#333',
        textStyle: { color: '#eee' },
        formatter: view === 'precio' ? undefined : tooltipFormatter, // Default formatter for Price is fine
        valueFormatter: view === 'precio' ? (value: number) => value?.toFixed(2) : undefined
      },
      xAxis: {
        type: 'category', 
        data: aligned.map(d => d.date),
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#475569" } },
        axisLabel: { color: "#cbd5e1" },
        splitLine: { show: false }
      }
    };

    let series: any[] = [];
    let yAxis: any = {};

    // --- LÓGICA POR VISTA ---

    if (view === "precio") {
      // PRECIO: Usamos dos ejes Y para manejar la diferencia de escala entre la acción y el índice (benchmark)
      const hasBenchmark = otherKeys.includes(benchmarkTicker);
      
      yAxis = [
        { 
          type: 'value', 
          position: 'right', 
          scale: true,
          splitLine: { show: false, lineStyle: { color: "rgba(148,163,184,0.15)" } },
          axisLabel: { color: "#cbd5e1" }
        },
        {
          type: 'value',
          position: 'left',
          scale: true,
          show: hasBenchmark, // Solo mostrar si hay benchmark
          splitLine: { show: false },
          axisLabel: { color: "#9ca3af", formatter: '{value}' } // Gris más oscuro para el benchmark
        }
      ];

      // Main Series (Stock) -> Axis 0
      series.push({
        name: getLabel(symbol),
        type: 'line',
        yAxisIndex: 0,
        showSymbol: false,
        connectNulls: false, // Mostrar huecos si faltan datos
        data: aligned.map(d => d['primary']), 
        itemStyle: { color: '#FFA028' },
        lineStyle: { width: 1 },
        /* endLabel: { show: true, formatter: '{a}', offset: [30, 0], color: 'inherit' }, */
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#ffbf007c' },
            { offset: 1, color: '#cf72008a' }
          ])
        }
      });

      // Others
      otherKeys.forEach((key, idx) => {
        const isBenchmark = key === benchmarkTicker;
        series.push({
          name: getLabel(key),
          type: 'line',
          yAxisIndex: isBenchmark ? 1 : 0, // Benchmark al eje secundario
          showSymbol: false,
          connectNulls: false,
          data: aligned.map(d => d[key]),
          itemStyle: { color: isBenchmark ? '#f8fbffff' : PEER_COLORS[idx % PEER_COLORS.length] }, // Benchmark gris claro
          lineStyle: isBenchmark ? { type: 'line', width: 1, opacity: 0.7 } : { width: 1 }
          /* endLabel: { show: true, formatter: '{a}', offset: [30, 0], color: 'inherit' } */
        });
      });

    } else if (view === "rel") {
      // RELATIVO: Normalizamos usando la función robusta
      yAxis = {
        type: 'value',
        position: 'right',
        scale: true,
        axisLabel: { formatter: '{value}%', color: "#cbd5e1" },
        splitLine: { show: false }
      };

      const normalizedData = normalizeRebase100(aligned, allKeys);

      // Main
      series.push({
        name: getLabel(symbol),
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        data: normalizedData.map(d => d['primary']),
        itemStyle: { color: '#FFA028' },
        lineStyle: { width: 1 }
        /* endLabel: { show: true, formatter: '{a}', offset: [40, 0], color: 'inherit' } */
      });

      // Others
      otherKeys.forEach((key, idx) => {
        const isBenchmark = key === benchmarkTicker;
        series.push({
          name: getLabel(key),
          type: 'line',
          showSymbol: false,
          connectNulls: false,
          data: normalizedData.map(d => d[key]),
          itemStyle: { color: isBenchmark ? '#f8fbffff' : PEER_COLORS[idx % PEER_COLORS.length] },
          lineStyle: isBenchmark ? { width: 1, type: 'line' } : { width: 1 }
          /* endLabel: { show: true, formatter: '{a}', offset: [40, 0], color: 'inherit' } */
        });
      });

    } else if (view === "drawdown") {
      // DRAWDOWN: Calculamos sobre los datos alineados para consistencia visual
      yAxis = {
        type: 'value',
        position: 'right',
        max: 0,
        axisLabel: { formatter: '{value}%', color: "#cbd5e1" },
        splitLine: { show: false }
      };

      // Función auxiliar para extraer array numérico (con nulls/NaNs)
      const getPrices = (key: string) => aligned.map(d => {
        const val = d[key];
        return (val === null || val === undefined || val === "" || Number.isNaN(Number(val))) 
             ? null 
             : Number(val);
      });

      // Main DD
      series.push({
        name: getLabel(symbol),
        type: 'line',
        showSymbol: false,
        connectNulls: false,
        data: calculateDrawdown(getPrices('primary')),
        itemStyle: { color: '#FFA028' },
        lineStyle: { width: 1 },
        areaStyle: { opacity: 0.2 }
       /*  endLabel: { show: true, formatter: '{a}', offset: [35, 0], color: 'inherit' } */
      });

      // Others DD
      otherKeys.forEach((key, idx) => {
        const isBenchmark = key === benchmarkTicker;
        series.push({
          name: getLabel(key),
          type: 'line',
          showSymbol: false,
          connectNulls: false,
          data: calculateDrawdown(getPrices(key)),
          itemStyle: { color: isBenchmark ? '#9ca3af' : PEER_COLORS[idx % PEER_COLORS.length] },
          lineStyle: isBenchmark ? { type: 'line', width: 1 } : { width: 1, opacity: 0.7 },
          areaStyle: isBenchmark ? { opacity: 0.1 } : undefined
          /* endLabel: { show: true, formatter: '{a}', offset: [35, 0], color: 'inherit' } */
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
    if (!getOption) {
      console.warn(`[ChartsTab] renderChart: getOption returned null for ${symbol}. chartData is:`, chartData);
      console.log(`[ChartsTab] DataMap keys:`, Object.keys(dataMap));
      if (dataMap[symbol]) {
          console.log(`[ChartsTab] Main symbol data length:`, dataMap[symbol].length);
      }
      return <div className="h-full grid place-items-center text-zinc-500">Sin datos</div>;
    }

    return (
      <ReactECharts
        key={`${symbol}-${view}-${range}-${comparedSymbols.join('-')}`} 
        echarts={echarts as any}
        option={getOption}
        notMerge
        lazyUpdate
        style={{ height: "100%", width: "100%" }}
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-tarjetas overflow-hidden border-none shadow-none">
      <div className="flex items-center justify-between w-full border-b border-zinc-800 bg-transparent shrink-0 z-10">
        <div className="flex gap-0.5">
          {(["1A", "3A", "5A", "MAX"] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`
                rounded-none border-b-2 px-3 py-1 text-xs transition-colors font-medium
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

        {/* Optional Title Placeholder if needed, but keeping clean for now */}
        {/* <h4 className="text-xs font-medium text-gray-400 hidden sm:block">
          <span className="text-[#FFA028]">{symbol}</span>
        </h4> */}

        <div className="flex gap-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`
                rounded-none border-b-2 px-3 py-1 text-xs transition-colors font-medium
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

      <div className="flex-1 min-h-0 relative w-full border border-t-0 border-zinc-800">
        {renderChart()}
      </div>
    </div>
  );
}
