"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { fmp } from "@/lib/fmp/client";
import type { 
  ValuationResponse, 
  RatiosResponse, 
  GrowthResponse, 
  ProfileResponse, 
  InstitutionalHoldersResponse 
} from "@/lib/fmp/types";

// ECharts imports
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent, // Added DatasetComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Register ECharts components
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent, // Added DatasetComponent
  CanvasRenderer,
]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

interface EstimacionTabProps {
  selectedStock?: any;
}

export default function EstimacionTab({ selectedStock }: EstimacionTabProps) {
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState<{
    valuation: ValuationResponse | null;
    ratios: RatiosResponse | null;
    growth: GrowthResponse | null;
    profile: ProfileResponse | null;
    holders: InstitutionalHoldersResponse | null;
  }>({
    valuation: null,
    ratios: null,
    growth: null,
    profile: null,
    holders: null
  });

  const symbol = selectedStock?.symbol || "AAPL";
  const currentPrice = selectedStock?.price || apiData.profile?.[0]?.price || 0;

  useEffect(() => {
    if (!symbol) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [valuation, ratios, growth, profile, holders] = await Promise.all([
          fmp.valuation(symbol).catch((e) => { console.warn(e); return null; }),
          fmp.ratios(symbol, { limit: 1 }).catch((e) => { console.warn(e); return null; }),
          fmp.growth(symbol, { limit: 1 }).catch((e) => { console.warn(e); return null; }),
          fmp.profile(symbol).catch((e) => { console.warn(e); return null; }),
          fmp.institutionalHolders(symbol).catch((e) => { console.warn(e); return null; })
        ]);
        setApiData({ valuation, ratios, growth, profile, holders });
      } catch (e) {
        console.error("Error fetching estimation data", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  // Derived Data Calculation
  const derivedData = useMemo(() => {
    // 1. Target Price Calculation
    let targetPrice = 0;
    let recommendation = "N/A";
    
    if (apiData.valuation && currentPrice) {
        // Use pre-calculated consensus upside/downside if available
        if (apiData.valuation.discountVsPt !== null) {
            targetPrice = currentPrice * (1 + apiData.valuation.discountVsPt / 100);
        } else {
            // Fallback to growth-based projection
            const growthRate = apiData.growth?.[0]?.revenueGrowth || 0.05; // default 5%
            targetPrice = currentPrice > 0 ? currentPrice * (1 + growthRate) : 100 * (1 + growthRate);
        }
        
        // Recommendation logic
        const upside = currentPrice > 0 ? (targetPrice - currentPrice) / currentPrice : 0;
        if (upside > 0.15) recommendation = "Compra Fuerte";
        else if (upside > 0.05) recommendation = "Compra";
        else if (upside > -0.05) recommendation = "Mantener";
        else recommendation = "Esperar a corrección";
    }

    // 2. Hedge Funds
    const topHolders = apiData.holders?.slice(0, 3).map(h => h.holder) || ["Fund A", "Fund B", "Fund C"];

    // 3. Projections for Chart
    // Create quarters for next 2 years (8 quarters)
    const quarters = [];
    const projectionA = [];
    const projectionB = [];
    
    const baseVal = currentPrice || 100;
    const growthRate = (apiData.growth?.[0]?.revenueGrowth || 5) / 100;
    const volatility = 0.05;

    const currentYear = new Date().getFullYear();
    const startYear = currentYear + 1;

    // Generate 9 points (start to end of 2 years)
    for (let i = 0; i < 9; i++) {
        const yearOffset = Math.floor(i / 4);
        const qOffset = (i % 4) + 1;
        const yearLabel = i === 0 || i === 4 || i === 8 ? `${startYear + yearOffset}` : `${startYear + yearOffset}-Q${qOffset}`;
        quarters.push(yearLabel);

        // Simple projection logic
        const timeFactor = i / 4; // years
        const valA = baseVal * Math.pow(1 + growthRate, timeFactor) * (1 + (Math.random() * volatility - volatility/2));
        const valB = baseVal * Math.pow(1 + growthRate * 0.8, timeFactor) * (1 + (Math.random() * volatility - volatility/2)); // More conservative
        
        projectionA.push(parseFloat(valA.toFixed(2)));
        projectionB.push(parseFloat(valB.toFixed(2)));
    }

    return {
        targetPrice,
        recommendation,
        hedgeFunds: topHolders,
        chart: {
            categories: quarters,
            seriesA: projectionA,
            seriesB: projectionB
        }
    };
  }, [apiData, currentPrice]);

  // Static Data (Drivers/Risks/AI Summary) - In a real app, this would come from an AI backend
  const staticData = {
    drivers: [
      "Expansión en nuevos mercados",
      "Innovación en productos/servicios",
      "Mejora de márgenes operativos"
    ],
    risks: [
      "Competencia intensificada",
      "Cambios regulatorios",
      "Volatilidad económica"
    ],
    aiSummary: `Según las proyecciones actuales, ${symbol} muestra un potencial de crecimiento basado en sus métricas financieras. El precio objetivo estimado de $${derivedData.targetPrice.toFixed(2)} sugiere una oportunidad interesante. La valoración actual refleja las expectativas del mercado.`
  };

  const chartOption = useMemo(() => {
    // Debug log to verify data
    console.log("Chart Data:", derivedData.chart);
    
    return {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: 'Inter, sans-serif'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        borderColor: '#333',
        textStyle: { color: '#fff' }
      },
      legend: {
        show: true,
        textStyle: { color: '#ccc' },
        top: 0
      },
      grid: {
        top: 40,
        right: 20,
        bottom: 20,
        left: 40,
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: derivedData.chart.categories,
        axisLine: { show: true, lineStyle: { color: '#444' } },
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { show: true, lineStyle: { color: '#333', type: 'dashed' } }
      },
      series: [
        {
          name: 'Proyección Optimista',
          type: 'line',
          data: derivedData.chart.seriesA,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#6366f1' }, // Indigo
          lineStyle: { width: 2 },
          smooth: true
        },
        {
          name: 'Proyección Conservadora',
          type: 'line',
          data: derivedData.chart.seriesB,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#a855f7' }, // Purple
          lineStyle: { width: 2 },
          smooth: true
        }
      ]
    };
  }, [derivedData.chart]);

  return (
    <div className="flex flex-col gap-1 bg-[#0a0a0a] min-h-[600px] text-white p-1">
      
      {/* Top Section: Drivers/Risks & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 h-auto lg:h-[350px]">
        
        {/* Left Column: Drivers & Risks */}
        <div className="flex flex-col gap-1 h-full">
          
          {/* Drivers */}
          <div className="flex-1 bg-[#1A1B1D] border-l-4 border-green-600 flex flex-col">
            <div className="bg-[#1A1B1D] py-2 px-4 text-center border-b border-gray-800">
              <span className="text-gray-200 font-medium">Drivers de crecimiento</span>
            </div>
            <div className="p-4 flex flex-col justify-center gap-4 flex-1">
              {staticData.drivers.map((driver, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-green-500 shrink-0" />
                  <span className="text-green-100 text-sm lg:text-base font-light tracking-wide">{driver}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          <div className="flex-1 bg-[#1A1B1D] border-l-4 border-red-800 flex flex-col">
            <div className="bg-[#1A1B1D] py-2 px-4 text-center border-b border-gray-800">
              <span className="text-gray-200 font-medium">Factores de riesgo</span>
            </div>
            <div className="p-4 flex flex-col justify-center gap-4 flex-1">
              {staticData.risks.map((risk, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600 shrink-0" />
                  <span className="text-red-100 text-sm lg:text-base font-light tracking-wide">{risk}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Chart */}
        <div className="bg-[#1A1B1D] flex flex-col h-full">
          <div className="py-2 text-center">
            <span className="text-gray-200 font-medium">Estimación a 2 años</span>
          </div>
          <div className="flex-1 w-full min-h-[300px] h-[300px] lg:h-auto">
            {loading ? (
                <div className="flex items-center justify-center h-full text-gray-500">Cargando gráfico...</div>
            ) : (
                <ReactECharts 
                echarts={echarts}
                option={chartOption} 
                style={{ height: '100%', width: '100%', minHeight: '300px' }}
                opts={{ renderer: 'canvas' }}
                notMerge={true}
                lazyUpdate={true}
                />
            )}
          </div>
        </div>

      </div>

      {/* Middle Section: Consensus */}
      <div className="bg-[#1A1B1D] mt-1">
        <div className="bg-[#1e293b] py-1 text-center border-b border-gray-700">
          <span className="text-gray-300 text-sm font-medium">Consenso de Analistas y Hedge Funds</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-700 border-t border-gray-700">
          
          {/* Price Target */}
          <div className="bg-[#0e7490] p-4 flex flex-col items-center justify-center text-center h-24">
            <div className="text-cyan-100 text-xs uppercase mb-1">Precio objetivo promedio de compra</div>
            <div className="text-white text-2xl font-bold">
                {loading ? "..." : derivedData.targetPrice.toFixed(2)}
            </div>
          </div>

          {/* Recommendation */}
          <div className="bg-[#0e7490] p-4 flex flex-col items-center justify-center text-center h-24">
            <div className="text-cyan-100 text-xs uppercase mb-1">Recomendación</div>
            <div className="text-white font-medium leading-tight">
                {loading ? "..." : derivedData.recommendation}
            </div>
          </div>

          {/* Analysts */}
          <div className="bg-[#0e7490] p-4 flex flex-col items-center justify-center text-center h-24">
            <div className="text-cyan-100 text-xs uppercase mb-1">Analistas</div>
            <div className="text-white text-2xl font-bold">12</div>
          </div>

          {/* Hedge Funds */}
          <div className="bg-[#0e7490] p-4 flex flex-col justify-center h-24 pl-6">
            <div className="text-cyan-100 text-xs uppercase mb-1 text-center md:text-left">Hedge funds</div>
            <ul className="text-cyan-50 text-xs space-y-0.5 list-none">
              {loading ? (
                <li>Cargando...</li>
              ) : (
                derivedData.hedgeFunds.map((fund, i) => (
                    <li key={i} className="flex items-center gap-1">
                    <span className="w-2 h-[1px] bg-cyan-300"></span>
                    {fund}
                    </li>
                ))
              )}
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Section: AI Summary */}
      <div className="bg-[#1A1B1D] mt-1">
        <div className="bg-[#1e293b] py-1 text-center border-b border-gray-700">
          <span className="text-gray-300 text-sm font-medium uppercase">Resumen IA de {symbol}</span>
        </div>
        <div className="p-6 bg-[#0e7490]">
          <p className="text-cyan-50 text-sm leading-relaxed text-justify">
            {staticData.aiSummary}
          </p>
        </div>
      </div>

    </div>
  );
}