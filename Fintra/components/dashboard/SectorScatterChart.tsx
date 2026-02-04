"use client";
// SectorScatterChart.tsx

/**
 * SCATTER CONTRACT (DO NOT MODIFY)
 * ================================
 *
 * FGOS es una métrica absoluta ∈ [0,100]
 * - No es relativa
 * - No se normaliza por sector
 * - No usa percentiles
 *
 * El umbral estructural de calidad es FGOS = 50
 * - Línea horizontal fija en Y = 50 (Quality Threshold)
 * - Separa empresas de calidad estructural de las que no
 *
 * Relative Performance es siempre relativa al sector (0 = neutral)
 * - X = 0: Performance igual al sector
 * - X > 0: Outperformance vs sector
 * - X < 0: Underperformance vs sector
 *
 * Los cuadrantes no se recalculan dinámicamente
 * - Eje X siempre centrado en 0 (no en media del sector)
 * - Eje Y siempre [0, 100] con línea en 50
 * - No hay ajustes por volatilidad o distribución
 *
 * No hay percentiles ni medias móviles en este panel
 * - Solo datos absolutos y relativos al sector
 * - Sin transformaciones estadísticas adicionales
 *
 * Esto evita discusiones futuras y drift conceptual.
 */

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { EnrichedStockData } from "@/lib/engine/types";
import { Switch } from "@/components/ui/switch";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const ACTIVE_WINDOW = "1Y";

// Define strict color palette
const COLORS = {
  leader: "#10b981", // Green
  follower: "#f59e0b", // Amber
  laggard: "#ef4444", // Red
  default: "#6b7280", // Gray (fallback)
};

const ACTIVE_COLOR = "#3b82f6"; // Bright Blue for active selection

interface ScatterPoint {
  ticker: string;
  x: number; // Relative Performance vs Sector (1Y)
  y: number; // FGOS Score
  size: number; // Market Cap (scaled)
  color: string;
  ifsPosition: string;
  marketCap: number;
  sentiment?: {
    band: string;
    confidence: number | null;
    sampleSize?: number;
    horizon?: string;
  };
}

interface SectorScatterChartProps {
  data: EnrichedStockData[];
  hoveredTicker: string | null;
  activeTicker?: string;
  onPointClick?: (ticker: string) => void;
}

export default function SectorScatterChart({
  data: rawData,
  hoveredTicker,
  activeTicker,
  onPointClick,
}: SectorScatterChartProps) {
  const [benchmarkType, setBenchmarkType] = useState<"Industry" | "Sector">("Industry");

  const chartPoints = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    console.log("🔍 [SectorScatter] Raw data count:", rawData.length);
    console.log("🔍 [SectorScatter] Sample data:", rawData.slice(0, 3));
    console.log(
      "🔍 [SectorScatter] Sample alpha values:",
      rawData.slice(0, 10).map((d) => ({
        ticker: d.ticker,
        alphaVsIndustry1Y: d.alphaVsIndustry1Y,
        alphaVsSector1Y: d.alphaVsSector1Y,
        fgosScore: d.fgosScore,
      })),
    );

    // Calculate min/max log market cap for sizing
    let minLogCap = Infinity;
    let maxLogCap = -Infinity;

    // Filter valid data - REQUIRE both FGOS and Alpha
    const validData = rawData.filter((item) => {
      const hasValidFGOS =
        item.fgosScore !== null && item.fgosScore !== undefined;
      
      const alphaVal = benchmarkType === "Industry" ? item.alphaVsIndustry1Y : item.alphaVsSector1Y;
      const hasValidPerf = alphaVal !== null && alphaVal !== undefined;
      
      const hasIFS = !!item.ifs?.position;

      if (!hasValidPerf) {
        console.log(
          `⚠️ [SectorScatter] ${item.ticker}: Missing Alpha vs ${benchmarkType}`,
        );
      }

      return hasValidFGOS && hasValidPerf; // Require both for valid scatter point
    });

    console.log("✅ [SectorScatter] Valid data count:", validData.length);
    console.log("✅ [SectorScatter] Filtered sample:", validData.slice(0, 3));

    validData.forEach((item) => {
      const marketCap = item.marketCap || 0;
      if (marketCap > 0) {
        const logCap = Math.log10(marketCap);
        if (logCap < minLogCap) minLogCap = logCap;
        if (logCap > maxLogCap) maxLogCap = logCap;
      }
    });

    const capRange = maxLogCap - minLogCap || 1;

    const chartPoints = validData.map((item) => {
      const ifsPos = (item.ifs?.position || "default") as keyof typeof COLORS;
      // Base color from IFS position, but will be overridden in render if active
      const baseColor = COLORS[ifsPos] || COLORS.default;

      const marketCap = item.marketCap || 0;
      let size = 10;

      if (marketCap > 0) {
        const logCap = Math.log10(marketCap);
        // Scale between 5 and 30
        size = 5 + ((logCap - minLogCap) / capRange) * 25;
      }

      // Extract sentiment
      // Note: EnrichedStockData might not have deep nested sentiment_details in fgos_components
      // We'll use what's available or adapt based on EnrichedStockData structure
      // For now, using top level sentimentBand if available, or placeholder
      const sentiment = {
        band: item.sentimentBand || "insufficient data",
        confidence: null, // Add if available in EnrichedStockData
        sampleSize: undefined,
        horizon: undefined,
      };

      return {
        ticker: item.ticker,
        x: (benchmarkType === "Industry" ? item.alphaVsIndustry1Y : item.alphaVsSector1Y)!, // Relative Performance vs Benchmark (validated in filter)
        y: item.fgosScore!, // FGOS Score (validated in filter)
        size,
        color: baseColor,
        ifsPosition: ifsPos,
        marketCap,
        sentiment,
      };
    });

    console.log("📊 [SectorScatter] Final chart points:", chartPoints.length);
    console.log("📊 [SectorScatter] Sample points:", chartPoints.slice(0, 3));

    return chartPoints;
  }, [rawData, benchmarkType]);

  const option = useMemo(() => {
    return {
      grid: {
        top: 30,
        right: 55,
        bottom: 20,
        left: 0,
        containLabel: true,
      },
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const pt = params.data;
          return `
            <div class="font-bold mb-1">${pt.ticker}</div>
            <div class="text-xs text-zinc-400 mb-2">
              Market Cap: $${(pt.marketCap / 1e9).toFixed(2)}B
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span class="text-zinc-500">FGOS Score:</span>
              <span class="font-mono text-right">${pt.y?.toFixed(1)}</span>
              <span class="text-zinc-500">Alpha (${benchmarkType}):</span>
              <span class="font-mono text-right ${pt.x >= 0 ? "text-emerald-400" : "text-red-400"}">${pt.x > 0 ? "+" : ""}${pt.x?.toFixed(2)}%</span>
            </div>
          `;
        },
        backgroundColor: "#18181b",
        borderColor: "#27272a",
        textStyle: { color: "#e4e4e7" },
      },
      xAxis: {
        type: "value",
        name: `Alpha vs ${benchmarkType} (1 Year)`,
        nameLocation: "middle",
        nameGap: 30,
        nameTextStyle: {
          fontSize: 11,
          color: "#a1a1aa",
        },
        splitLine: {
          lineStyle: { color: "#27272a" },
        },
        axisLabel: {
          color: "#71717a",
          formatter: "{value}%",
        },
        axisLine: false,
      },
      yAxis: {
        type: "value",
        name: "FGOS Score (Quality Metric)",
        nameTextStyle: {
          fontSize: 11,
          color: "#a1a1aa",
        },
        min: 0,
        max: 100,
        splitLine: {
          lineStyle: { color: "#27272a" },
        },
        axisLabel: { color: "#71717a" },
        axisLine: false,
      },
      series: [
        {
          type: "scatter",
          symbolSize: function (dataItem: any) {
            // When data has {value: [x,y], size: ...}, ECharts passes the full object
            return dataItem?.size || 10;
          },
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            label: {
              show: true,
              position: "end",
              formatter: "{b}",
              color: "#00C0FF",
              fontSize: 10,
            },
            lineStyle: {
              color: "#00C0FF", // zinc-600
              type: "dashed",
              width: 1,
              opacity: 0.8,
            },
            data: [
              { xAxis: 0, name: "Sector Average (0%)" },
              { yAxis: 50, name: "Quality \n\n Threshold" },
            ],
          },
          data: chartPoints.map((pt) => {
            const isHovered = hoveredTicker === pt.ticker;
            const isActive = activeTicker === pt.ticker;
            const hasInteraction = !!hoveredTicker || !!activeTicker;

            // Visual Rules Implementation:
            // 1. Active: Blue, Opacity 1, High Z-Index
            // 2. Hovered: Normal Color (or Blue if active), Opacity 1, Highest Z-Index
            // 3. Dimmed: If interaction exists and point is neither active nor hovered -> Opacity 0.2

            const isHighlighted = isActive || isHovered;
            const isDimmed = hasInteraction && !isHighlighted;

            let finalColor = pt.color;
            let opacity = 0.8;
            let z = 2;
            let borderColor = "#000";
            let borderWidth = 1;

            if (isActive) {
              finalColor = ACTIVE_COLOR; // Blue
              opacity = 1;
              z = 10;
              borderColor = "#fff";
              borderWidth = 2;
            }

            // Hover overrides z-index to bring to front, but keeps active color if active
            if (isHovered) {
              opacity = 1;
              z = 20;
              borderColor = "#fff";
              borderWidth = 2;
            }

            if (isDimmed) {
              opacity = 0.2;
              borderColor = "transparent"; // Remove border for dimmed
            }

            // ECharts scatter expects: [x, y] or { value: [x, y] }
            return {
              value: [pt.x, pt.y],
              ticker: pt.ticker,
              marketCap: pt.marketCap,
              ifsPosition: pt.ifsPosition,
              sentiment: pt.sentiment,
              size: pt.size,
              itemStyle: {
                color: finalColor,
                opacity: opacity,
                borderColor: borderColor,
                borderWidth: borderWidth,
              },
              z: z,
            };
          }),
          itemStyle: {
            shadowBlur: 2,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      ],
    };
  }, [chartPoints, hoveredTicker, activeTicker, benchmarkType]);

  const onEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (
          params.componentType === "series" &&
          onPointClick &&
          params.data?.ticker
        ) {
          onPointClick(params.data.ticker);
        }
      },
    }),
    [onPointClick],
  );

  if (!rawData || rawData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent text-[#666] text-xs">
        Select a sector to view structural positioning
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-transparent relative">
      <div className="absolute -bottom-2 right-0 z-10 flex items-center space-x-1">
        <span
          className={`text-[9px] ${benchmarkType === "Industry" ? "text-white font-bold" : "text-zinc-500"}`}
        >
          Industry
        </span>
        <Switch
          className="scale-[0.6] origin-center data-[state=unchecked]:bg-zinc-700 data-[state=checked]:bg-zinc-700"
          checked={benchmarkType === "Sector"}
          onCheckedChange={(checked) =>
            setBenchmarkType(checked ? "Sector" : "Industry")
          }
        />
        <span
          className={`text-[9px] ${benchmarkType === "Sector" ? "text-white font-bold" : "text-zinc-500"}`}
        >
          Sector
        </span>
      </div>
      <ReactECharts
        option={option}
        style={{ height: "100%", width: "100%" }}
        opts={{ renderer: "canvas" }}
        onEvents={onEvents}
      />
    </div>
  );
}
