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
import { getBalanceHistory } from "@/lib/services/server-financials";
import { MOCK_BALANCE_HISTORY } from "@/components/dashboard/mock-data";

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
    backgroundColor: '#0e0e0e',
    toolbox: {
      feature: {
        saveAsImage: {
          title: "Guardar imagen",
          name: `${symbol} - Balance`,
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
      axisPointer: { 
        type: 'shadow',
        shadowStyle: { color: 'rgba(255, 255, 255, 0.03)' }
      },
      backgroundColor: '#000000',
      borderColor: '#333333',
      textStyle: { color: '#EDEDED', fontSize: 12 },
      padding: [10, 14],
      extraCssText: 'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); border-radius: 8px;',
      formatter: (params: any) => {
          let res = `<div style="font-weight:500; margin-bottom:8px; color:#EDEDED; font-size:12px">${params[0].axisValue}</div>`;
          params.forEach((p: any) => {
              res += `<div style="display:flex;justify-content:space-between;gap:20px;font-size:12px;margin-bottom:4px;align-items:center">
                <div style="display:flex;align-items:center;gap:6px">
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background-color:${p.color}"></span>
                    <span style="color:#A1A1AA">${p.seriesName}</span>
                </div>
                <span style="font-weight:600; font-family:monospace; color:#EDEDED">${formatValue(p.value)}</span>
              </div>`;
          });
          return res;
      }
    },
    legend: {
      data: ['Revenue', 'Total Debt', 'Net Income'],
      bottom: 0,
      textStyle: { color: '#A1A1AA', fontSize: 11, fontWeight: 500 },
      itemWidth: 8,
      itemHeight: 8,
      icon: 'circle',
      itemGap: 24
    },
    grid: {
      left: '2%',
      right: '2%',
      bottom: '12%',
      top: '8%',
      containLabel: true,
      show: true,
      backgroundColor: '#1c1c1c',
      borderColor: '#262626',
      borderWidth: 1
    },
    xAxis: {
      type: 'category',
      data: data.years,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#71717A', fontSize: 11, margin: 16, fontWeight: 500, fontFamily: 'Inter, sans-serif' }
    },
    yAxis: {
      type: 'value',
      splitLine: { show: true, lineStyle: { color: '#262626', width: 1 } },
      axisLabel: { show: false },
      max: (value: { max: number }) => {
          return value.max * 1.45; // Add 45% headroom for rotated labels
      }
    },
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        data: data.revenue,
        itemStyle: { color: '#3B82F6', borderRadius: [4, 4, 0, 0] }, // Blue-500 (Brighter)
        barMaxWidth: 32,
        barGap: '20%', // Add spacing between bar groups
        label: {
            show: true,
            position: 'top',
            formatter: (p: any) => formatValue(p.value),
            color: '#D4D4D8',
            fontSize: 10,
            fontWeight: 500,
            rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            distance: 8,
            fontFamily: 'Inter, sans-serif',
            overflow: 'truncate',
            width: 60
        }
      },
      {
        name: 'Total Debt',
        type: 'bar',
        data: data.debt,
        itemStyle: { color: '#71717A', borderRadius: [4, 4, 0, 0] }, // Zinc-500
        barMaxWidth: 32,
        label: {
            show: true,
            position: 'top',
            formatter: (p: any) => formatValue(p.value),
            color: '#A1A1AA',
            fontSize: 10,
            fontWeight: 500,
            rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            distance: 8,
            fontFamily: 'Inter, sans-serif',
            overflow: 'truncate',
            width: 60
        }
      },
      {
        name: 'Net Income',
        type: 'bar',
        data: data.netIncome,
        itemStyle: { color: '#0EA5E9', borderRadius: [4, 4, 0, 0] }, // Sky-500
        barMaxWidth: 32,
        label: {
            show: true,
            position: 'top',
            formatter: (p: any) => formatValue(p.value),
            color: '#38BDF8', // Brighter text for visibility
            fontSize: 10,
            fontWeight: 500,
            rotate: 90,
            align: 'left',
            verticalAlign: 'middle',
            distance: 8,
            fontFamily: 'Inter, sans-serif',
            overflow: 'truncate',
            width: 60
        }
      }
    ],
    textStyle: {
        fontFamily: 'Inter, sans-serif'
    }
  };

  return <ReactECharts echarts={echarts} option={option} style={{ height: '100%', width: '100%' }} />;
}
