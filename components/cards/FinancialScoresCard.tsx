// components/cards/FinancialScoresCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent, LegendComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3 } from "lucide-react";
import { fmp } from "@/lib/fmp/client";

echarts.use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

// Función mejorada para formatear números grandes
const fmtLargeNumber = (v?: number | null, d = 1) => {
  if (v == null) return "N/A";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(d)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(d)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(d)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(d)}K`;
  return `$${v.toFixed(0)}`;
};

// Función para formatear números completos con separadores de miles
const fmtFullNumber = (v?: number | null) => {
  if (v == null) return "N/A";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(v);
};

const numOrNull = (x: any): number | null => {
  if (x === null || x === undefined || x === '') {
    return null;
  }
  
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// Tipo local para los datos financieros (siguiendo el patrón de FundamentalCard)
type FinancialScoreData = {
  symbol: string;
  reportedCurrency?: string;
  altmanZScore: number | null;
  piotroskiScore: number | null;
  workingCapital?: number;
  totalAssets?: number;
  retainedEarnings?: number;
  ebit?: number;
  marketCap?: number;
  totalLiabilities?: number;
  revenue?: number;
  raw?: any; // Datos originales de FMP para acceso directo
};

export default function FinancialScoresCard({ symbol }: { symbol: string }) {
  const [scoresData, setScoresData] = useState<FinancialScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const scores = await fmp.scores(symbol);
        const scoreData = Array.isArray(scores) && scores.length ? scores[0] : scores;
        setScoresData(scoreData);
      } catch (err: any) {
        setError(err?.message || "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  // Configuración del gráfico de barras horizontales combinado
  const combinedOption = useMemo(() => {
    if (!scoresData) {
      return null;
    }

    // Los datos están en scoresData.raw, no directamente en scoresData
    const rawData = scoresData.raw || scoresData;

    // Preparar datos de scores (normalizados a escala 0-100)
    const altmanZ = numOrNull(rawData.altmanZScore);
    const piotroski = numOrNull(rawData.piotroskiScore);
    
    const normalizedAltman = altmanZ ? Math.min(Math.max((altmanZ / 10) * 100, 0), 100) : 0;
    const normalizedPiotroski = piotroski ? (piotroski / 9) * 100 : 0;

    // Preparar datos financieros (en billones para normalizar)
    const totalAssets = numOrNull(rawData.totalAssets);
    const totalLiabilities = numOrNull(rawData.totalLiabilities);
    const revenue = numOrNull(rawData.revenue);
    const ebit = numOrNull(rawData.ebit);
    const marketCap = numOrNull(rawData.marketCap);

    const categories = [
      'Altman Z-Score',
      'Piotroski Score',
      'Total Assets',
      'Total Liabilities', 
      'Revenue',
      'EBIT',
      'Market Cap'
    ];

    const chartData = [
      { value: normalizedAltman, original: altmanZ, unit: '', color: '#10B981' },
      { value: normalizedPiotroski, original: piotroski, unit: '/9', color: '#3B82F6' },
      { value: totalAssets ? (totalAssets / 1e12) * 10 : 0, original: totalAssets, unit: '', color: '#8B5CF6' },
      { value: totalLiabilities ? (totalLiabilities / 1e12) * 10 : 0, original: totalLiabilities, unit: '', color: '#EF4444' },
      { value: revenue ? (revenue / 1e12) * 10 : 0, original: revenue, unit: '', color: '#F59E0B' },
      { value: ebit ? Math.max((ebit / 1e11) * 10, 0) : 0, original: ebit, unit: '', color: '#06B6D4' },
      { value: marketCap ? (marketCap / 1e12) * 10 : 0, original: marketCap, unit: '', color: '#F97316' }
    ];

    const option = {
      backgroundColor: "transparent",
      grid: {
        left: "25%",
        right: "10%",
        top: "5%",
        bottom: "5%",
      },
      xAxis: {
        type: "value",
        max: 100,
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: "#374151",
          },
        },
        splitLine: {
          lineStyle: {
            color: "#374151",
            type: "dashed",
          },
        },
      },
      yAxis: {
        type: "category",
        data: categories,
        axisLabel: {
          color: "#9CA3AF",
          fontSize: 11,
        },
        axisLine: {
          lineStyle: {
            color: "#374151",
          },
        },
      },
      series: [
        {
          type: "bar",
          data: chartData.map((item, index) => ({
            value: item.value,
            itemStyle: {
              color: item.color,
            },
          })),
          barWidth: "60%",
        },
      ],
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1F2937",
        borderColor: "#374151",
        textStyle: {
          color: "#F3F4F6",
        },
        formatter: (params: any) => {
          const param = params[0];
          const dataItem = chartData[param.dataIndex];
          const category = categories[param.dataIndex];
          
          let displayValue = '';
          let fullValue = '';
          
          if (category.includes('Score')) {
            displayValue = `${dataItem.original?.toFixed(2) || 'N/A'}${dataItem.unit}`;
            fullValue = displayValue;
          } else {
            displayValue = fmtLargeNumber(dataItem.original);
            fullValue = fmtFullNumber(dataItem.original);
          }
          
          return `
            <div style="padding: 12px; min-width: 200px;">
              <div style="font-weight: bold; margin-bottom: 8px; color: #F59E0B;">${category}</div>
              <div style="margin-bottom: 4px; font-size: 16px;">${displayValue}</div>
              ${!category.includes('Score') && fullValue !== displayValue ? 
                `<div style="font-size: 12px; color: #9CA3AF; border-top: 1px solid #374151; padding-top: 4px; margin-top: 4px;">Valor completo: ${fullValue}</div>` : 
                ''}
            </div>
          `;
        },
      },
    };

    return option;
  }, [scoresData]);

  if (loading) {
    return (
      <Card className="bg-tarjetas border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Financial Scores — {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Cargando datos financieros...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !scoresData) {
    return (
      <Card className="bg-tarjetas border-gray-700/30">
        <CardHeader>
          <CardTitle className="text-orange-400 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Financial Scores — {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-red-400">
              {error || "No se pudieron cargar los datos financieros"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[492px] bg-tarjetas border-none">

      <CardHeader>
        <CardTitle className="text-orange-400 text-lg flex items-center gap-2">
          <div className="text-gray-400">
            Financial Scores 
          </div>
          {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Gráfico combinado */}
        <div>
          <h3 className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Análisis Financiero Completo
          </h3>
          <div className="h-60">
            {combinedOption ? (
              <ReactECharts
                echarts={echarts}
                option={combinedOption}
                style={{ height: "80%", width: "100%" }}
                opts={{ renderer: "canvas" }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                No hay datos suficientes para mostrar el gráfico
              </div>
            )}
          </div>
          
          {/* Resumen de scores */}
          <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Altman Z-Score</div>
              <div className="text-green-400 font-mono text-lg">
                {numOrNull((scoresData.raw || scoresData).altmanZScore)?.toFixed(2) || "N/A"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(numOrNull((scoresData.raw || scoresData).altmanZScore) || 0) > 3 ? "Zona Segura" : 
                 (numOrNull((scoresData.raw || scoresData).altmanZScore) || 0) > 1.8 ? "Zona Gris" : "Zona de Riesgo"}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-gray-400">Piotroski Score</div>
              <div className="text-blue-400 font-mono text-lg">
                {numOrNull((scoresData.raw || scoresData).piotroskiScore) || "N/A"}/9
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {(numOrNull((scoresData.raw || scoresData).piotroskiScore) || 0) >= 7 ? "Excelente" : 
                 (numOrNull((scoresData.raw || scoresData).piotroskiScore) || 0) >= 5 ? "Bueno" : "Débil"}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}