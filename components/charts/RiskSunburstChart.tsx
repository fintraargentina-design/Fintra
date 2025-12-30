"use client";

import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { fmp } from '@/lib/fmp/client';
import { transformRiskDataForSunburst, SunburstNode, getTopStocksByCountry } from '@/lib/services/risk-service';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import CountryStocksTreemap from './CountryStocksTreemap';
import { ScreenerItem } from '@/lib/fmp/types';

export default function RiskSunburstChart() {
  const [chartData, setChartData] = useState<SunburstNode | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Drill-down state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [countryStocks, setCountryStocks] = useState<ScreenerItem[]>([]);
  const [stocksLoading, setStocksLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await fmp.marketRiskPremium();
        if (data && Array.isArray(data)) {
           const transformed = transformRiskDataForSunburst(data);
           setChartData(transformed);
        }
      } catch (e) {
        console.error("Failed to load risk data", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const onChartClick = async (params: any) => {
    // Only drill down if it's a country node (has country property)
    if (params.data && params.data.country) {
       const country = params.data.country;
       setSelectedCountry(country);
       setSheetOpen(true);
       setStocksLoading(true);
       setCountryStocks([]); // Clear previous

       try {
           const stocks = await getTopStocksByCountry(country);
           setCountryStocks(stocks);
       } catch (e) {
           console.error("Failed to load stocks", e);
       } finally {
           setStocksLoading(false);
       }
    }
  };

  if (loading) return <div className="h-[400px] flex items-center justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Analizando Riesgo Soberano...</div>;
  if (!chartData) return <div className="h-[200px] flex items-center justify-center text-muted-foreground">No se pudo cargar el mapa de riesgo.</div>;

  const option = {
    backgroundColor: 'transparent',
    // Add hidden axes for the dummy scatter series to prevent "xAxis not found" error
    xAxis: { show: false, axisLine: { show: false } },
    yAxis: { show: false, axisLine: { show: false } },
    visualMap: {
      type: 'continuous',
      min: 0,
      max: 18,
      inRange: {
        color: ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444']
      },
      text: ['Alto Riesgo', 'Bajo Riesgo'],
      calculable: true,
      orient: 'vertical',
      left: 'left',
      bottom: '10%',
      seriesIndex: 1, // Bind only to the dummy scatter series to avoid coloring parent nodes in Sunburst
      textStyle: {
        color: '#6b7280'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      textStyle: {
        color: '#1f2937'
      },
      formatter: function (params: any) {
        const data = params.data;
        if (!data.country) return `<b>${data.name}</b>`;
        
        return `
          <div style="font-family:sans-serif; min-width:200px;">
            <div style="font-weight:bold; font-size:14px; margin-bottom:5px; border-bottom:1px solid #eee; padding-bottom:5px;">
              ${data.country} <span style="font-size:11px; font-weight:normal; color:#6b7280">(${data.rating})</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="color:#6b7280">Tasa Libre de Riesgo (Rf):</span>
              <b style="color:#1f2937">${data.riskFreeRate?.toFixed(2)}%</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span style="color:#6b7280">Prima de Riesgo (ERP):</span>
              <b style="color:${params.color}">${data.equityRiskPremium?.toFixed(2)}%</b>
            </div>
            <div style="margin-top:8px; padding-top:4px; border-top:1px dashed #eee; display:flex; justify-content:space-between;">
              <span style="color:#6b7280">Retorno Esperado Total:</span>
              <b style="color:#1f2937">${data.totalMarketReturn?.toFixed(2)}%</b>
            </div>
            <div style="margin-top:8px; font-size:10px; color:#3b82f6; text-align:center;">
               Click para ver Top Acciones
            </div>
          </div>
        `;
      }
    },
    series: [
      {
        type: 'sunburst',
        data: [chartData], // Wrap root in array
        radius: [0, '95%'],
        sort: undefined, // Respect data sorting
        emphasis: {
          focus: 'ancestor'
        },
        itemStyle: {
          borderRadius: 0,
          borderWidth: 2,
          borderColor: '#fff',
          shadowBlur: 0,
          shadowColor: 'transparent'
        },
        label: {
          rotate: 'radial',
          color: '#fff',
          textBorderColor: 'transparent',
          textShadowBlur: 0
        },
        levels: [
        {
            // Center (Global)
            r0: '0%',
            r: '15%',
            itemStyle: { color: '#f3f4f6' },
            label: { rotate: 0, color: '#374151', fontWeight: 'bold' }
        },
        {
            // Continents
            r0: '15%',
            r: '40%',
            itemStyle: { borderWidth: 2, color: '#f3f4f6' },
            label: { rotate: 'tangential', minAngle: 10, color: '#374151' }
        },
        {
            // Countries (Leaf nodes)
            r0: '40%',
            r: '95%',
            itemStyle: { borderWidth: 3 },
            label: { 
                align: 'right', 
                minAngle: 5, 
                padding: 3, 
                color: '#fff', 
                textShadowBlur: 5, 
                textShadowColor: '#333',
                position: 'inside'
            }
        }
      ]
      },
      {
        // Dummy series for VisualMap to bind to, so it renders the legend but doesn't mess up the Sunburst parent nodes
        type: 'scatter',
        data: [{value: 0}, {value: 18}], 
        symbolSize: 0,
        silent: true
      }
    ]
  };

  return (
    <>
    <Card className="w-full shadow-none border-none bg-transparent rounded-none">
        <CardHeader className="pb-2 text-center">
            <CardTitle className="text-xl">Mapa Global de Riesgo Soberano</CardTitle>
            <CardDescription>Haga click en un país para ver sus acciones principales</CardDescription>
        </CardHeader>
        <CardContent>
            <ReactECharts 
                option={option} 
                style={{ height: '500px', width: '100%' }} 
                onEvents={{
                    click: onChartClick
                }}
            />
             <p className="text-center text-[10px] text-gray-400 mt-2">
                * El tamaño del arco representa el Retorno de Mercado Total (Rf + ERP).
            </p>
        </CardContent>
    </Card>

    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-xl border-t-2">
            <CountryStocksTreemap 
                countryName={selectedCountry} 
                stocks={countryStocks} 
                loading={stocksLoading} 
            />
        </SheetContent>
    </Sheet>
    </>
  );
}
