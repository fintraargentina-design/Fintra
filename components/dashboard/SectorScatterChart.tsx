"use client";
// SectorScatterChart.tsx
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { EnrichedStockData } from '@/lib/engine/types';

const ACTIVE_WINDOW = '1Y';

// Define strict color palette
const COLORS = {
  leader: '#10b981',   // Green
  follower: '#f59e0b', // Amber
  laggard: '#ef4444',  // Red
  default: '#6b7280'   // Gray (fallback)
};

const ACTIVE_COLOR = '#3b82f6'; // Bright Blue for active selection

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
}

export default function SectorScatterChart({ 
  data: rawData,
  hoveredTicker,
  activeTicker
}: SectorScatterChartProps) {
  
  const chartPoints = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];

    // Calculate min/max log market cap for sizing
    let minLogCap = Infinity;
    let maxLogCap = -Infinity;
    
    // Filter valid data first
    const validData = rawData.filter(item => 
      item.fgosScore !== null && 
      item.fgosScore !== undefined &&
      item.relativeReturn1Y !== null && 
      item.relativeReturn1Y !== undefined &&
      item.ifs?.position
    );

    validData.forEach(item => {
      const marketCap = item.marketCap || 0;
      if (marketCap > 0) {
        const logCap = Math.log10(marketCap);
        if (logCap < minLogCap) minLogCap = logCap;
        if (logCap > maxLogCap) maxLogCap = logCap;
      }
    });

    const capRange = maxLogCap - minLogCap || 1;

    return validData.map(item => {
      const ifsPos = (item.ifs?.position || 'default') as keyof typeof COLORS;
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
        band: item.sentimentBand || 'insufficient data',
        confidence: null, // Add if available in EnrichedStockData
        sampleSize: undefined,
        horizon: undefined
      };

      return {
        ticker: item.ticker,
        x: item.relativeReturn1Y, // Relative Performance vs Sector
        y: item.fgosScore, // FGOS Score
        size,
        color: baseColor,
        ifsPosition: ifsPos,
        marketCap,
        sentiment
      };
    });
  }, [rawData]);

  const option = useMemo(() => {
    return {
      grid: {
        top: 40,
        right: 30,
        bottom: 40,
        left: 50,
        containLabel: true
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const pt = params.data;
          return `
            <div class="font-bold mb-1">${pt.ticker}</div>
            <div class="text-xs text-zinc-400 mb-2">
              Market Cap: $${(pt.marketCap / 1e9).toFixed(2)}B
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span class="text-zinc-500">FGOS:</span>
              <span class="font-mono text-right">${pt.y?.toFixed(0)}</span>
              <span class="text-zinc-500">Rel Perf:</span>
              <span class="font-mono text-right">${pt.x > 0 ? '+' : ''}${pt.x?.toFixed(1)}%</span>
            </div>
          `;
        },
        backgroundColor: '#18181b',
        borderColor: '#27272a',
        textStyle: { color: '#e4e4e7' }
      },
      xAxis: {
        type: 'value',
        name: 'Rel Perf (1Y)',
        nameLocation: 'middle',
        nameGap: 25,
        splitLine: {
          lineStyle: { color: '#27272a' }
        },
        axisLabel: { color: '#71717a' },
        axisLine: { lineStyle: { color: '#52525b' } }
      },
      yAxis: {
        type: 'value',
        name: 'FGOS Score',
        min: 0,
        max: 100,
        splitLine: {
          lineStyle: { color: '#27272a' }
        },
        axisLabel: { color: '#71717a' },
        axisLine: { lineStyle: { color: '#52525b' } }
      },
      series: [
        {
          type: 'scatter',
          symbolSize: (data: any) => data?.size || 10,
          data: chartPoints.map(pt => {
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
            let borderColor = '#000';
            let borderWidth = 1;

            if (isActive) {
              finalColor = ACTIVE_COLOR; // Blue
              opacity = 1;
              z = 10;
              borderColor = '#fff';
              borderWidth = 2;
            }
            
            // Hover overrides z-index to bring to front, but keeps active color if active
            if (isHovered) {
              opacity = 1;
              z = 20; 
              borderColor = '#fff';
              borderWidth = 2;
            }

            if (isDimmed) {
              opacity = 0.2;
              borderColor = 'transparent'; // Remove border for dimmed
            }

            return {
              ...pt,
              itemStyle: {
                color: finalColor,
                opacity: opacity,
                borderColor: borderColor,
                borderWidth: borderWidth
              },
              z: z
            };
          }),
          itemStyle: {
            shadowBlur: 2,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      ]
    };
  }, [chartPoints, hoveredTicker, activeTicker]);

  if (!rawData || rawData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0A0A0A] text-zinc-600 text-xs">
        Select a sector to view structural positioning
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0A0A0A] relative">
      <ReactECharts 
        option={option} 
        style={{ height: '100%', width: '100%' }} 
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
