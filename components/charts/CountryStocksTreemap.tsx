"use client";

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { ScreenerItem } from '@/lib/fmp/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';

interface CountryStocksTreemapProps {
  countryName: string;
  stocks: ScreenerItem[];
  loading: boolean;
}

export default function CountryStocksTreemap({ countryName, stocks, loading }: CountryStocksTreemapProps) {
  const option = useMemo(() => {
    if (!stocks.length) return {};

    const data = stocks.map(stock => ({
      name: stock.symbol,
      value: [stock.marketCap, stock.beta || 1], // [Size, ColorValue]
      
      // Extra props for tooltip
      companyName: stock.companyName,
      sector: stock.sector,
      industry: stock.industry,
      price: stock.price,
      beta: stock.beta,
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const { name, value, companyName, sector, industry, price, beta } = params.data;
          // value[0] is marketCap
          const mktCapB = (value[0] / 1e9).toFixed(2) + 'B';
          return `
            <div class="font-bold text-base mb-1">${name}</div>
            <div class="text-sm font-semibold text-gray-700">${companyName}</div>
            <div class="text-xs text-gray-500 mb-2">${sector} | ${industry}</div>
            <div class="grid grid-cols-2 gap-x-4 text-xs">
              <div>Market Cap:</div><div class="font-mono font-bold">$${mktCapB}</div>
              <div>Price:</div><div class="font-mono font-bold">$${price}</div>
              <div>Beta:</div><div class="font-mono font-bold">${beta}</div>
            </div>
          `;
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#1f2937' },
        extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 6px; padding: 12px;'
      },
      visualMap: {
        min: 0.5,
        max: 2.0,
        dimension: 1, // Use beta for color
        inRange: {
            color: ['#10b981', '#fbbf24', '#ef4444'] // Green -> Amber -> Red
        },
        text: ['High Volatility (Beta)', 'Low Volatility'],
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        itemWidth: 10,
        itemHeight: 100
      },
      series: [{
        type: 'treemap',
        data: data,
        layoutAlgorithm: 'squarified',
        leafDepth: 1,
        roam: false,
        breadcrumb: { show: false },
        width: '90%',
        height: '80%',
        top: '5%',
        left: 'center',
        itemStyle: {
          borderColor: '#fff',
          gapWidth: 1,
          borderWidth: 1
        },
        label: {
            show: true,
            formatter: '{b}'
        },
        upperLabel: {
            show: true,
            height: 30
        }
      }]
    };
  }, [stocks, countryName]);

  return (
    <Card className="h-full border-0 shadow-none rounded-none w-full">
      <CardHeader className="pb-2 border-b">
        <CardTitle className="text-xl">Principales Acciones: {countryName}</CardTitle>
        <CardDescription>Top 30 empresas por Capitalización de Mercado (Coloreado por Beta)</CardDescription>
      </CardHeader>
      <CardContent className="h-[600px] p-0 relative">
        {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground animate-pulse">Cargando acciones de {countryName}...</span>
            </div>
        ) : stocks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                No hay datos disponibles para {countryName}
            </div>
        ) : (
            <ReactECharts 
                option={option} 
                style={{ height: '100%', width: '100%' }} 
                opts={{ renderer: 'canvas' }}
            />
        )}
      </CardContent>
    </Card>
  );
}
