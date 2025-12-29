"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, AlertCircle, Globe, Wallet } from "lucide-react"; // Iconos nuevos
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; // Necesitarás este componente de Shadcn
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Registrar componentes
echarts.use([GraphChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

// --- DATA TYPES & MOCKS ---
export interface EcoItem {
  id: string;
  n: string;
  country?: string; // Nuevo campo
  dep: number; 
  val: number; 
  ehs: number; 
  fgos: number; // Salud Financiera
  geo_score?: number; // Estabilidad Geopolítica (Nuevo)
  txt: string;
}

// Mock actualizado con geo_score
const MOCK = {
  prov: [
    { id: "TSM", n: "Taiwan Semi", country: "TW", dep: 92, val: 40, ehs: 88, fgos: 92, geo_score: 30, txt: "Crítico / Riesgo TW" },
    { id: "FOX", n: "Foxconn", country: "CN", dep: 85, val: 78, ehs: 55, fgos: 58, geo_score: 40, txt: "Riesgo Op." },
    { id: "GLW", n: "Corning", country: "US", dep: 40, val: 30, ehs: 72, fgos: 65, geo_score: 95, txt: "Estable" },
    { id: "QCOM", n: "Qualcomm", country: "US", dep: 30, val: 50, ehs: 80, fgos: 85, geo_score: 90, txt: "Fuerte" }
  ],
  cli: [
    { id: "BBY", n: "Best Buy", country: "US", dep: 18, val: 62, ehs: 45, fgos: 42, geo_score: 90, txt: "Volátil" },
    { id: "JD", n: "JD.com", country: "CN", dep: 22, val: 25, ehs: 40, fgos: 35, geo_score: 25, txt: "Riesgo Geo" },
    { id: "AMZN", n: "Amazon", country: "US", dep: 12, val: 80, ehs: 90, fgos: 88, geo_score: 95, txt: "Gigante" }
  ]
};

// Heatmap unificado (Funciona para FGOS y GeoScore)
const getHeatmapColor = (score: number | undefined) => {
  if (score === undefined) return "#1e293b"; // Gris si no hay dato
  if (score >= 80) return "#008000"; // Verde (Seguro/Sano)
  if (score >= 60) return "#004D00";
  if (score >= 40) return "#806600"; // Amarillo oscuro (Precaución)
  if (score >= 20) return "#660000"; // Rojo (Peligro)
  return "#330000"; // Rojo Oscuro (Crítico)
};

const getNodeSize = (dep: number) => Math.max(25, Math.min(dep * 1.5, 90));

interface EcosystemCardProps {
  mainTicker?: string;
  mainImage?: string;
  suppliers?: EcoItem[];
  clients?: EcoItem[];
}

export default function EcosystemCard({ 
  mainTicker = "AAPL", 
  mainImage,
  suppliers = MOCK.prov, 
  clients = MOCK.cli 
}: EcosystemCardProps) {
  
  // Estado para controlar la "Lente" de visión
  const [viewMode, setViewMode] = useState<"financial" | "geopolitical">("financial");

  const chartOption = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    
    // NODO CENTRAL
    nodes.push({
      name: mainTicker,
      x: 0, y: 0,
      symbol: mainImage ? `image://${mainImage}` : 'circle',
      symbolSize: 100,
      itemStyle: {
        color: "#FFA028",
        shadowBlur: 0,
        shadowColor: viewMode === 'geopolitical' ? "#3b82f6" : "rgba(255,255,255,0.5)"
      },
      label: { show: !mainImage, position: "inside", fontSize: 16, fontWeight: "bold", color: "#000" },
      tooltip: { formatter: "Empresa Analizada" }
    });

    // Helper para procesar nodos
    const processNodes = (items: EcoItem[], isSupplier: boolean) => {
      items.forEach((item, index) => {
        const spreadY = (index - (items.length - 1) / 2) * 120;
        const xPos = isSupplier ? -350 : 350;

        // Determinar qué score usar según el modo
        const activeScore = viewMode === 'financial' ? item.fgos : (item.geo_score ?? 50);
        const color = getHeatmapColor(activeScore);

        nodes.push({
          name: item.id,
          x: xPos,
          y: spreadY,
          symbolSize: getNodeSize(item.dep),
          itemStyle: {
            color: color,
            borderColor: "rgba(255,255,255,0.3)",
            borderWidth: 1
          },
          label: {
            show: true,
            position: isSupplier ? "left" : "right",
            // Mostramos info diferente según el modo
            formatter: viewMode === 'financial' 
              ? `{b}\n${item.dep}% Dep` 
              : `{b}\n[${item.country || '?'}]`, 
            fontSize: 10,
            color: "#9ca3af"
          },
          data: item
        });

        links.push({
          source: isSupplier ? item.id : mainTicker,
          target: isSupplier ? mainTicker : item.id,
          symbol: isSupplier ? ['none', 'arrow'] : ['none', 'arrow'],
          lineStyle: {
            width: Math.max(1, item.dep / 15),
            curveness: 0,
            // Las líneas también pueden cambiar de color sutilmente
            color: activeScore < 40 ? "#7f1d1d" : "#4b5563", 
            opacity: 0.6
          }
        });
      });
    };

    processNodes(suppliers, true);
    processNodes(clients, false);

    return {
      backgroundColor: "transparent",
      animationDurationUpdate: 1000, // Animación suave al cambiar de modo
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(10, 10, 10, 0.95)",
        borderColor: "#333",
        textStyle: { color: "#fff" },
        formatter: (params: any) => {
          if (params.dataType === 'edge' || params.name === mainTicker) return null;
          const d = params.data.data as EcoItem;
          
          // Tooltip Dinámico
          const scoreLabel = viewMode === 'financial' ? "Salud Financiera" : "Estabilidad Geo.";
          const scoreValue = viewMode === 'financial' ? d.fgos : (d.geo_score ?? "N/A");
          const scoreColor = getHeatmapColor(viewMode === 'financial' ? d.fgos : d.geo_score);

          return `
            <div class="text-xs p-2 min-w-[180px]">
              <div class="font-bold text-sm mb-2 flex items-center justify-between border-b border-white/10 pb-1">
                <span class="flex items-center gap-2">
                  ${d.country ? `<span class="text-[10px] bg-white/20 px-1 rounded">${d.country}</span>` : ''} 
                  ${d.n}
                </span>
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between">
                  <span class="text-gray-400">Dependencia:</span> 
                  <span class="font-mono text-white font-bold">${d.dep}%</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">${scoreLabel}:</span> 
                  <span class="font-mono font-bold px-1.5 rounded text-white" style="background:${scoreColor}">
                    ${scoreValue}/100
                  </span>
                </div>
                <div class="mt-2 text-[10px] italic text-gray-500 border-t border-white/5 pt-1">
                  "${d.txt}"
                </div>
              </div>
            </div>
          `;
        }
      },
      series: [{
        type: "graph",
        layout: "none",
        symbol: "circle",
        roam: true,
        zoom: 0.8,
        label: { show: true, color: "#fff" },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [4, 10],
        data: nodes,
        links: links
      }]
    };
  }, [mainTicker, suppliers, clients, viewMode]); // Dependencia clave: viewMode

  // ... (Manejo de estado vacío igual que antes)

  return (
    <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col group relative overflow-hidden">
      <CardHeader className="pb-1 pt-0 px-4 flex flex-row items-center justify-between border-b border-white/5 shrink-0 z-10">
        <CardTitle className="text-[#FFA028] text-sm flex gap-2 items-center"> 
          <span>Mapa de Ecosistema</span>
        </CardTitle>
        
        {/* --- TOGGLE DE VISTAS --- */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider hidden sm:block">Lente:</span>
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(val) => val && setViewMode(val as any)}
            className="scale-75 origin-right" // Hacerlo más compacto
          >
            <ToggleGroupItem value="financial" aria-label="Financiero" className="data-[state=on]:bg-[#FFA028] data-[state=on]:text-black text-xs px-2 h-7">
              <Wallet className="w-3 h-3 mr-1" /> Finanzas
            </ToggleGroupItem>
            <ToggleGroupItem value="geopolitical" aria-label="Geopolítico" className="data-[state=on]:bg-blue-500 data-[state=on]:text-white text-xs px-2 h-7">
              <Globe className="w-3 h-3 mr-1" /> Geopolítica
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-[350px] relative bg-gradient-to-b from-transparent to-black/20">
        <div className="absolute inset-0">
          <ReactECharts 
            echarts={echarts}
            option={chartOption} 
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>
        
        {/* Leyenda Dinámica */}
        <div className="absolute bottom-2 left-4 flex gap-4 text-[9px] text-gray-400 bg-black/40 p-1.5 rounded-lg backdrop-blur-sm pointer-events-none">
           <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${viewMode === 'financial' ? 'bg-green-600' : 'bg-green-500'}`}></div>
            {viewMode === 'financial' ? 'Solvente' : 'Jurisdicción Segura'}
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${viewMode === 'financial' ? 'bg-red-800' : 'bg-red-600'}`}></div>
            {viewMode === 'financial' ? 'Riesgo Quiebra' : 'Zona Conflicto/Sanciones'}
          </div>
        </div>

        {/* Etiquetas de zona */}
        <div className="absolute top-4 left-4 text-[10px] uppercase font-bold text-gray-400 tracking-[0.2em] pointer-events-none opacity-50">Proveedores</div>
        <div className="absolute top-4 right-4 text-[10px] uppercase font-bold text-gray-400 tracking-[0.2em] pointer-events-none opacity-50">Clientes</div>
      </CardContent>
    </Card>
  );
}