"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { fmp } from "@/lib/fmp/client";

echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), {
  ssr: false,
});

interface FinancialsHistoryChartProps {
  symbol: string;
}

interface ChartData {
  years: string[];
  revenue: number[];
  debt: number[];
  marketCap: number[];
}

export default function FinancialsHistoryChart({ symbol }: FinancialsHistoryChartProps) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!symbol) return;
      setLoading(true);
      try {
        // Fetch last 5 years of data
        // 1. Income Statement for Revenue
        const incomePromise = fmp.incomeStatement(symbol, { limit: 5 });
        // 2. Balance Sheet for Total Debt
        const balancePromise = fmp.balanceSheet(symbol, { limit: 5 });
        // 3. Enterprise Values for Market Cap at year end
        const evPromise = fmp.enterpriseValues(symbol, { limit: 5 });

        const [income, balance, ev] = await Promise.all([
            incomePromise, 
            balancePromise,
            evPromise
        ]);

        if (!active) return;

        // Process data
        // We align by year. FMP returns descending order (newest first).
        // We want ascending for the chart.
        const reversedIncome = [...income].reverse();
        
        // Create a map for alignment by year
        const dataMap = new Map<string, { revenue?: number; debt?: number; marketCap?: number }>();

        reversedIncome.forEach((item: any) => {
            const year = item.date.split('-')[0];
            if (!dataMap.has(year)) dataMap.set(year, {});
            dataMap.get(year)!.revenue = item.revenue;
        });

        balance.forEach((item: any) => {
            const year = item.date.split('-')[0];
            if (dataMap.has(year)) {
                dataMap.get(year)!.debt = item.totalDebt;
            }
        });

        ev.forEach((item: any) => {
            const year = item.date.split('-')[0];
            if (dataMap.has(year)) {
                dataMap.get(year)!.marketCap = item.marketCapitalization;
            }
        });

        const years = Array.from(dataMap.keys()).sort();
        const revenue = years.map(y => dataMap.get(y)?.revenue || 0);
        const debt = years.map(y => dataMap.get(y)?.debt || 0);
        const marketCap = years.map(y => dataMap.get(y)?.marketCap || 0);

        setData({ years, revenue, debt, marketCap });

      } catch (error) {
        console.error("Error fetching financials history:", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => { active = false; };
  }, [symbol]);

  if (loading) return <div className="h-full w-full flex items-center justify-center text-zinc-500 text-xs">Cargando datos...</div>;
  if (!data || data.years.length === 0) return <div className="h-full w-full flex items-center justify-center text-zinc-500 text-xs">No hay datos históricos</div>;

  const formatValue = (val: number) => {
      if (val >= 1e12) return (val / 1e12).toFixed(1) + 'T';
      if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
      if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
      return val.toString();
  };

  const option = {
    backgroundColor: 'transparent',
    toolbox: {
      feature: {
        saveAsImage: {
          title: "Guardar imagen",
          name: `${symbol} - Financials`,
          backgroundColor: "#0e0e0e",
          pixelRatio: 2
        }
      },
      iconStyle: {
        borderColor: "#666",
        borderWidth: 1.5
      },
      emphasis: {
        iconStyle: {
          borderColor: "#00C8FF"
        }
      },
      right: 0,
      top: 0
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: '#18181b',
      borderColor: '#27272a',
      textStyle: { color: '#e4e4e7' },
      formatter: (params: any) => {
          let res = `<div>${params[0].axisValue}</div>`;
          params.forEach((p: any) => {
              res += `<div style="display:flex;justify-content:space-between;gap:10px;">
                <span>${p.marker} ${p.seriesName}</span>
                <span style="font-weight:bold">${formatValue(p.value)}</span>
              </div>`;
          });
          return res;
      }
    },
    legend: {
      data: ['Revenue', 'Total Debt', 'Mkt Cap'],
      top: 0,
      textStyle: { color: '#a1a1aa', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '5%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: data.years,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#e4e4e7', fontSize: 10, margin: 10 }
    },
    yAxis: {
      type: 'value',
      splitLine: { show: false },
      axisLabel: { show: false }
    },
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        data: data.revenue,
        itemStyle: { color: '#1e3a8a' }, // Dark Blue
        barGap: 0,
        label: {
            show: true,
            position: 'insideBottom',
            formatter: (p: any) => formatValue(p.value),
            color: '#fff',
            fontSize: 9,
            rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            distance: 5
        }
      },
      {
        name: 'Total Debt',
        type: 'bar',
        data: data.debt,
        itemStyle: { color: '#71717a' }, // Grey
        label: {
            show: true,
            position: 'insideBottom',
            formatter: (p: any) => formatValue(p.value),
            color: '#fff',
            fontSize: 9,
             rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            distance: 5
        }
      },
      {
        name: 'Mkt Cap',
        type: 'bar',
        data: data.marketCap,
        itemStyle: { color: '#0ea5e9' }, // Light Blue
        label: {
            show: true,
            position: 'insideBottom',
            formatter: (p: any) => formatValue(p.value),
            color: '#fff',
            fontSize: 9,
             rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            distance: 5
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}
