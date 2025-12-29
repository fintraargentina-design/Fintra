"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, Globe, Wallet, AlertCircle } from "lucide-react"; 
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; 
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Registrar componentes de ECharts
echarts.use([GraphChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

// --- DATA TYPES ---
export interface EcoItem {
  id: string;
  n: string;
  country?: string; 
  dep: number; // Dependencia %
  val: number; // Valuación
  ehs: number; // Ecosystem Health Score
  fgos: number; // Financial Score
  geo_score?: number; // Geopolitical Score (100 = Seguro, 0 = Zona de Guerra)
  txt: string; // Razón / Contexto
}

// --- MOCK DATA: APPLE FORENSIC ANALYSIS (Basado en Reporte Fintra) ---
const APPLE_MOCK_DATA = {
  mainTicker: "AAPL",
  suppliers: [
    { 
      id: "TSM", 
      n: "TSMC", 
      country: "TW", 
      dep: 100, 
      val: 90, 
      ehs: 95, 
      fgos: 92, 
      geo_score: 20, 
      txt: "Punto Único de Falla / Riesgo Invasión" 
    },
    { 
      id: "FOX", 
      n: "Foxconn", 
      country: "CN", 
      dep: 60, 
      val: 50, 
      ehs: 60, 
      fgos: 55, 
      geo_score: 40, 
      txt: "Dependencia Crítica de China" 
    },
    { 
      id: "TATA", 
      n: "Tata Electronics", 
      country: "IN", 
      dep: 25, 
      val: 65, 
      ehs: 70, 
      fgos: 60, 
      geo_score: 85, 
      txt: "Diversificación 'China Plus One'" 
    },
    { 
      id: "SSNLF", 
      n: "Samsung Elec", 
      country: "KR", 
      dep: 70, 
      val: 75, 
      ehs: 80, 
      fgos: 82, 
      geo_score: 65, 
      txt: "Oligopolio Memoria y Pantallas" 
    },
    { 
      id: "GLW", 
      n: "Corning", 
      country: "US", 
      dep: 40, 
      val: 55, 
      ehs: 85, 
      fgos: 72, 
      geo_score: 100, 
      txt: "Monopolio 'Ceramic Shield'" 
    }
  ],
  clients: [
    { 
      id: "GOOGL", 
      n: "Alphabet (Google)", 
      country: "US", 
      dep: 20, 
      val: 85, 
      ehs: 90, 
      fgos: 95, 
      geo_score: 30, 
      txt: "Riesgo Regulatorio (DOJ) $20MM/año" 
    },
    { 
      id: "CHN", 
      n: "China Market", 
      country: "CN", 
      dep: 19, 
      val: 40, 
      ehs: 50, 
      fgos: 40, 
      geo_score: 35, 
      txt: "Nacionalismo / Erosión de Cuota" 
    },
    { 
      id: "USA", 
      n: "USA Market", 
      country: "US", 
      dep: 42, 
      val: 80, 
      ehs: 95, 
      fgos: 90, 
      geo_score: 95, 
      txt: "Mercado Core / Estable" 
    }
  ]
};

// --- HEATMAP UTILS ---
const getHeatmapColor = (score: number | undefined) => {
  if (score === undefined) return "#1e293b"; 
  if (score >= 80) return "#008000"; // Verde Sólido
  if (score >= 60) return "#004D00"; // Verde Oscuro
  if (score >= 40) return "#806600"; // Amarillo/Marrón
  if (score >= 20) return "#660000"; // Rojo
  return "#330000"; // Rojo Crítico
};

// Tamaño del nodo según dependencia
const getNodeSize = (dep: number) => Math.max(25, Math.min(dep * 1.5, 90));

interface EcosystemCardProps {
  mainTicker?: string;
  mainImage?: string;
  suppliers?: EcoItem[];
  clients?: EcoItem[];
}

export default function EcosystemCard({ 
  mainTicker = APPLE_MOCK_DATA.mainTicker, 
  mainImage,
  suppliers = APPLE_MOCK_DATA.suppliers, 
  clients = APPLE_MOCK_DATA.clients 
}: EcosystemCardProps) {
  
  // Estado para controlar la "Lente" de visión (Financiera vs Geopolítica)
  const [viewMode, setViewMode] = useState<"financial" | "geopolitical">("financial");

  const chartOption = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    
    // 1. NODO CENTRAL
    nodes.push({
      name: mainTicker,
      x: 0, y: 0,
      symbol: mainImage ? `image://${mainImage}` : 'circle',
      symbolSize: 100,
      itemStyle: {
        color: "#FFA028",
        shadowBlur: 15,
        shadowColor: viewMode === 'geopolitical' ? "#3b82f6" : "rgba(255,255,255,0.3)"
      },
      label: { show: !mainImage, position: "inside", fontSize: 16, fontWeight: "bold", color: "#000" },
      tooltip: { formatter: `<div class="font-bold px-2 text-center text-sm">${mainTicker}</div>` }
    });

    // 2. HELPER PARA PROCESAR NODOS
    const processNodes = (items: EcoItem[], isSupplier: boolean) => {
      items.forEach((item, index) => {
        // Distribución vertical calculada para centrar los nodos
        const spreadY = (index - (items.length - 1) / 2) * 120;
        const xPos = isSupplier ? -350 : 350;

        // Determinar qué score usar (Switch Lógico)
        const activeScore = viewMode === 'financial' ? item.fgos : (item.geo_score ?? 50);
        const color = getHeatmapColor(activeScore);
        const isCriticalRisk = activeScore <= 30;

        nodes.push({
          name: item.id,
          x: xPos,
          y: spreadY,
          symbolSize: getNodeSize(item.dep),
          itemStyle: {
            color: color,
            borderColor: "rgba(255,255,255,0.3)",
            borderWidth: 1,
            // Efecto de brillo si es riesgo crítico en modo geopolítico
            shadowBlur: (viewMode === 'geopolitical' && isCriticalRisk) ? 15 : 0,
            shadowColor: "red"
          },
          label: {
            show: true,
            position: isSupplier ? "left" : "right",
            formatter: viewMode === 'financial' 
              ? `{b}\n${item.dep}% Dep` 
              : `{b}\n[${item.country || '?'}]`, 
            fontSize: 10,
            color: "#9ca3af"
          },
          data: item // Guardamos la data completa para el tooltip
        });

        links.push({
          source: isSupplier ? item.id : mainTicker,
          target: isSupplier ? mainTicker : item.id,
          lineStyle: {
            width: Math.max(1, item.dep / 15),
            curveness: 0,
            // Las líneas se ponen rojas si conectan con un nodo de alto riesgo
            color: isCriticalRisk ? "#7f1d1d" : "#4b5563", 
            opacity: 0.6
          }
        });
      });
    };

    processNodes(suppliers, true);
    processNodes(clients, false);

    return {
      backgroundColor: "transparent",
      animationDurationUpdate: 1000, // Transición suave entre modos
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(10, 10, 10, 0.95)",
        borderColor: "#333",
        textStyle: { color: "#fff" },
        formatter: (params: any) => {
          if (params.dataType === 'edge' || params.name === mainTicker) return null;
          const d = params.data.data as EcoItem;
          if (!d) return null;
          
          // Lógica de visualización del Tooltip
          const isGeoMode = viewMode === 'geopolitical';
          const scoreLabel = isGeoMode ? "Estabilidad Geo." : "Salud Financiera";
          const scoreValue = isGeoMode ? (d.geo_score ?? "N/A") : d.fgos;
          const scoreColor = getHeatmapColor(isGeoMode ? d.geo_score : d.fgos);
          
          // Alerta visual en el header del tooltip
          const isHighRisk = isGeoMode && d.geo_score && d.geo_score <= 40;
          const headerClass = isHighRisk 
            ? "border-b border-red-900 bg-red-900/20 text-red-200" 
            : "border-b border-white/10";

          return `
            <div class="text-xs min-w-[210px] rounded-sm font-sans">
              <div class="font-bold text-sm px-3 py-2 flex items-center justify-between ${headerClass}">
                <span class="flex items-center gap-2">
                  ${d.country ? `<span class="text-[9px] bg-white/10 px-1.5 py-0.5 rounded border border-white/10 font-mono">${d.country}</span>` : ''} 
                  ${d.n}
                </span>
                ${isHighRisk ? '<span class="text-[9px] text-red-500 font-extrabold border border-red-900 px-1 rounded bg-black">RIESGO</span>' : ''}
              </div>
              
              <div class="p-3 space-y-2">
                <div class="flex justify-between border-b border-white/5 pb-2">
                  <span class="text-gray-400">Dependencia:</span> 
                  <span class="font-mono text-white font-bold">${d.dep}%</span>
                </div>
                
                <div class="flex justify-between items-center">
                  <span class="text-gray-400">${scoreLabel}:</span> 
                  <span class="font-mono font-bold px-1.5 rounded text-white text-[10px]" style="background:${scoreColor}">
                    ${scoreValue}/100
                  </span>
                </div>

                <div class="mt-2 pt-2">
                   ${isGeoMode 
                      ? `<div class="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Factor de Riesgo:</div>
                         <div class="text-xs italic text-blue-200 font-medium leading-tight">"${d.txt}"</div>`
                      : `<div class="text-[10px] italic text-gray-500 leading-tight">"${d.txt}"</div>`
                   }
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
        roam: true, // Zoom y Pan habilitados
        zoom: 0.8,
        label: { show: true, color: "#fff" },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [4, 10],
        data: nodes,
        links: links
      }]
    };
  }, [mainTicker, suppliers, clients, viewMode, mainImage]);

  // Estado vacío
  if (!suppliers.length && !clients.length) {
    return (
      <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col items-center justify-center p-6 text-gray-500">
        <Globe className="w-12 h-12 mb-3 opacity-20" />
        <span className="text-sm font-medium">Esperando datos de Inteligencia...</span>
      </Card>
    );
  }

  return (
    <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col group relative overflow-hidden">
      <CardHeader className="pb-1 pt-0 px-4 flex flex-row items-center justify-between border-b border-white/5 shrink-0 z-10">
        <CardTitle className="text-gray-300 text-sm flex gap-2 items-center"> 
          <span>Mapa de Ecosistema</span>
        </CardTitle>
        
        {/* --- TOGGLE DE LENTES (FINANCIERO vs GEOPOLÍTICO) --- */}
        <div className="flex items-center gap-2">
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(val) => val && setViewMode(val as any)}
            className="scale-90 origin-right border border-white/10 rounded-md p-0.5 bg-black/20"
          >
            <ToggleGroupItem 
              value="financial" 
              aria-label="Financiero" 
              className="data-[state=on]:bg-[#FFA028] data-[state=on]:text-black text-gray-400 text-[10px] px-2 h-6 rounded-sm transition-all hover:text-white"
            >
              <Wallet className="w-3 h-3 mr-1.5" /> Finanzas
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="geopolitical" 
              aria-label="Geopolítico" 
              className="data-[state=on]:bg-blue-600 data-[state=on]:text-white text-gray-400 text-[10px] px-2 h-6 rounded-sm transition-all hover:text-white"
            >
              <Globe className="w-3 h-3 mr-1.5" /> Geopolítica
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
        
        {/* Leyenda Dinámica (Cambia según el modo) */}
        <div className="absolute bottom-2 left-4 flex gap-4 text-[9px] text-gray-400 bg-black/60 p-1.5 px-3 rounded-full backdrop-blur-md border border-white/5 pointer-events-none transition-all duration-500 z-10">
           <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_5px] ${viewMode === 'financial' ? 'bg-green-600 shadow-green-900' : 'bg-green-500 shadow-green-500'}`}></div>
            {viewMode === 'financial' ? 'Solvente' : 'Jurisdicción Segura'}
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full shadow-[0_0_5px] ${viewMode === 'financial' ? 'bg-red-800 shadow-red-900' : 'bg-red-600 shadow-red-600'}`}></div>
            {viewMode === 'financial' ? 'Riesgo Quiebra' : 'Zona Conflicto'}
          </div>
        </div>

        {/* Etiquetas de zona fijas */}
        <div className="absolute top-4 left-4 text-[9px] uppercase font-bold text-gray-300 tracking-[0.2em] pointer-events-none opacity-40">Proveedores</div>
        <div className="absolute top-4 right-4 text-[9px] uppercase font-bold text-gray-300 tracking-[0.2em] pointer-events-none opacity-40">Clientes</div>
      </CardContent>
    </Card>
  );
}