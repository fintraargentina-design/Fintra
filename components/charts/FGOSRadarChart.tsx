"use client";
// FGOS Radar Chart Component
// Fintra/components/charts/FGOSRadarChart.tsx
import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts/core';
import { RadarChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

// Registrar componentes necesarios de ECharts
echarts.use([RadarChart, TitleComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// Importar ReactECharts dinámicamente
const ReactECharts = dynamic(() => import('echarts-for-react/lib/core'), { ssr: false });

// Helper para parsear JSONB si viene como string
const parseBreakdown = (d: any) => {
  if (!d) return null;
  if (typeof d === 'string') {
    try {
      return JSON.parse(d);
    } catch (e) {
      console.error("Error parsing breakdown JSON", e);
      return null;
    }
  }
  return d;
};

// Helper para obtener valor numérico de objetos complejos (ej. moat: { value: 100, ... })
const getValue = (val: any) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null) {
      // Si tiene propiedad value, usarla. Si no, 0.
      return typeof val.value === 'number' ? val.value : 0;
  }
  return 0;
};

export default function FGOSRadarChart({ 
  symbol, 
  data, 
  comparedSymbol,
  isActive = true 
}: { 
  symbol: string, 
  data: any, 
  comparedSymbol?: string | null,
  isActive?: boolean 
}) {
  const [peerData, setPeerData] = useState<any>(null);
  const [loadingPeer, setLoadingPeer] = useState(false);
  
  // ECharts instance ref
  const chartRef = React.useRef<any>(null);

  // Lifecycle Control: Resize on activation
  useEffect(() => {
    if (isActive && chartRef.current) {
      const timer = setTimeout(() => {
        try {
          chartRef.current.resize();
        } catch (e) {
          console.warn("FGOS Chart resize failed", e);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Fetch peer data when comparedSymbol changes
  useEffect(() => {
    if (!comparedSymbol || comparedSymbol === "none") {
      setPeerData(null);
      return;
    }
    
    let active = true;
    (async () => {
      setLoadingPeer(true);
      try {
        const tickerFilter = (comparedSymbol as string).toUpperCase();
        const { data, error } = await supabase
          .from('fintra_snapshots')
          .select('fgos_components')
          .eq('ticker', tickerFilter)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (active) {
          if (data?.fgos_components) {
            setPeerData(data.fgos_components);
          } else {
             console.warn(`No FGOS components for ${comparedSymbol}, peer data unavailable`);
             setPeerData(null);
          }
        }
      } catch (e) {
        console.error("Error fetching peer data", e);
        if (active) setPeerData(null);
      } finally {
        if (active) setLoadingPeer(false);
      }
    })();
    return () => { active = false; };
  }, [comparedSymbol]);

  const option = useMemo(() => {
    const dimensions = [
        { key: 'profitability', label: 'Rentabilidad' },
        { key: 'growth', label: 'Crecimiento' },
        { key: 'solvency', label: 'Solvencia' },
        { key: 'efficiency', label: 'Eficiencia' },
        { key: 'moat', label: 'Ventaja Comp.' },
        { key: 'sentiment', label: 'Sentimiento' },
    ];

    const indicator = dimensions.map(d => ({ name: d.label, max: 100 }));
    
    // Values for main symbol
    const parsedData = parseBreakdown(data);
    const mainValues = dimensions.map(d => getValue(parsedData?.[d.key]));
    // Values for peer
    const parsedPeerData = parseBreakdown(peerData);
    const peerValues = parsedPeerData ? dimensions.map(d => getValue(parsedPeerData[d.key])) : [];

    const seriesData = [
      {
        value: mainValues,
        name: symbol,
        itemStyle: { color: '#FFA028' },
        areaStyle: { color: '#FFA028', opacity: 0.3 },
        symbol: 'none'
      }
    ];

    if (peerData && comparedSymbol) {
      seriesData.push({
        value: peerValues,
        name: comparedSymbol,
        itemStyle: { color: '#002D72' },
        areaStyle: { color: '#002D72', opacity: 0.5 },
        symbol: 'none'
      });
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        textStyle: { color: '#f3f4f6' },
        confine: true
      },
      legend: {
        data: [symbol, ...(peerData && comparedSymbol ? [comparedSymbol] : [])],
        bottom: 5,
        left: 5,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { 
          color: '#9CA3AF',
          fontSize: 10
        },
        icon: 'rect'
      },
      radar: {
        indicator: indicator,
        shape: 'polygon',
        radius: '50%',
        center: ['50%', '50%'],
        splitNumber: 4,
        axisName: {
          color: '#9CA3AF',
          fontSize: 11,
          padding: [3, 5]
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        splitArea: {
          show: false
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      series: [
        {
          type: 'radar',
          data: seriesData,
          symbolSize: 4
        }
      ]
    };
  }, [data, peerData, symbol, comparedSymbol]);

  return (
    <Card className="bg-tarjetas border-none h-full shadow-lg py-0 flex flex-col relative group">
      <CardContent className="flex-1 min-h-0 w-full p-2">
        <div className="w-full h-full">
            <ReactECharts
                echarts={echarts}
                option={option}
                style={{ height: '100%', width: '100%' }}
                onChartReady={(instance) => { chartRef.current = instance; }}
            />
        </div>
      </CardContent>
    </Card>
  );
}
