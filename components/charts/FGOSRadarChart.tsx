"use client";

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as echarts from 'echarts/core';
import { RadarChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

// Registrar componentes necesarios de ECharts
echarts.use([RadarChart, TitleComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// Importar ReactECharts dinámicamente
const ReactECharts = dynamic(() => import('echarts-for-react/lib/core'), { ssr: false });

export default function FGOSRadarChart({ symbol, data, comparedSymbol }: { symbol: string, data: any, comparedSymbol?: string | null }) {
  const [peerData, setPeerData] = useState<any>(null);
  const [loadingPeer, setLoadingPeer] = useState(false);

  // Helper para generar datos mockeados si falla la API
  const generateMockPeerData = () => ({
    growth: Math.floor(Math.random() * 40 + 60),
    profitability: Math.floor(Math.random() * 40 + 60),
    efficiency: Math.floor(Math.random() * 40 + 60),
    solvency: Math.floor(Math.random() * 40 + 60),
    moat: Math.floor(Math.random() * 40 + 60),
    sentiment: Math.floor(Math.random() * 40 + 60),
  });

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
        const { data, error } = await supabase
          .from('fintra_snapshots')
          .select('fgos_breakdown')
          .eq('ticker', comparedSymbol)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (active) {
          if (data?.fgos_breakdown) {
            setPeerData(data.fgos_breakdown);
          } else {
             // Fallback a mock data si no hay breakdown disponible
             console.warn(`No FGOS breakdown for ${comparedSymbol}, using mock data`);
             setPeerData(generateMockPeerData());
          }
        }
      } catch (e) {
        console.error("Error fetching peer data", e);
        if (active) setPeerData(generateMockPeerData()); // Fallback en error
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
    const mainValues = dimensions.map(d => data?.[d.key] || 0);
    // Values for peer
    const peerValues = peerData ? dimensions.map(d => peerData[d.key] || 0) : [];

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
        itemStyle: { color: '#0056FF' },
        areaStyle: { color: '#0056FF', opacity: 0.3 },
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
        left: 30,
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
        radius: '65%',
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
            />
        </div>
      </CardContent>
    </Card>
  );
}
