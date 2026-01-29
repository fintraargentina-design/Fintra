"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { getBalanceHistory } from "@/lib/services/server-financials";
import { MOCK_BALANCE_HISTORY } from "@/components/dashboard/mock-data";

echarts.use([
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), {
  ssr: false,
});

interface BalanceBarChartProps {
  symbol: string;
}

interface ChartData {
  years: string[];
  revenue: number[];
  debt: number[];
  netIncome: number[];
}

export default function BalanceBarChart({ symbol }: BalanceBarChartProps) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      if (!symbol) return;
      setLoading(true);
      try {
        // Fetch from Supabase via Server Action
        const result = await getBalanceHistory(symbol);

        if (!active) return;

        if (result && result.years.length > 0) {
            setData(result);
        } else {
             console.warn("No Supabase financial data found for", symbol, "using mock data.");
             setData(MOCK_BALANCE_HISTORY);
        }

      } catch (error) {
        console.error("Error fetching financials history:", error);
        // Fallback to mock data on error
        setData(MOCK_BALANCE_HISTORY);
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
      data: ['Revenue', 'Total Debt', 'Net Income'],
      top: 0,
      textStyle: { color: '#ffffff', fontSize: 10},
      itemWidth: 10,
      itemHeight: 4,
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '5%',
      top: '5%',
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
        name: 'Net Income',
        type: 'bar',
        data: data.netIncome,
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

  return <ReactECharts echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} />;
}
