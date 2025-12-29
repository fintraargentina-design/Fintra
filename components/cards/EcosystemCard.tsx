"use client";

import React, { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, AlertCircle } from "lucide-react";
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { fmp } from "@/lib/fmp/client";

// Registrar componentes de ECharts
echarts.use([GraphChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

// --- DATA TYPES & MOCKS ---
export interface EcoItem {
  id: string;
  n: string;
  dep: number; // Dependencia %
  val: number; // Valuation
  ehs: number; // Ecosystem Health Score
  fgos: number; // Financial Score
  txt: string;
}

const MOCK = {
  prov: [
    { id: "TSM", n: "Taiwan Semi", dep: 92, val: 40, ehs: 88, fgos: 92, txt: "Crítico" },
    { id: "FOX", n: "Foxconn", dep: 85, val: 78, ehs: 55, fgos: 58, txt: "Riesgo Op." },
    { id: "GLW", n: "Corning", dep: 40, val: 30, ehs: 72, fgos: 65, txt: "Estable" },
    { id: "QCOM", n: "Qualcomm", dep: 30, val: 50, ehs: 80, fgos: 85, txt: "Fuerte" }
  ],
  cli: [
    { id: "BBY", n: "Best Buy", dep: 18, val: 62, ehs: 45, fgos: 42, txt: "Volátil" },
    { id: "VZ", n: "Verizon", dep: 14, val: 55, ehs: 60, fgos: 58, txt: "Cash Flow" },
    { id: "JD", n: "JD.com", dep: 22, val: 25, ehs: 40, fgos: 35, txt: "Riesgo Geo" },
    { id: "AMZN", n: "Amazon", dep: 12, val: 80, ehs: 90, fgos: 88, txt: "Gigante" }
  ]
};

// --- TU HEATMAP COLORS (Tu Estética) ---
const getHeatmapColor = (score: number | null) => {
  if (score == null) return "#1e293b";
  if (score >= 90) return "#008000"; 
  if (score >= 80) return "#006600"; 
  if (score >= 70) return "#004D00"; 
  if (score >= 60) return "#003300"; 
  if (score >= 50) return "#001A00"; 
  if (score <= 10) return "#800000"; 
  if (score <= 20) return "#660000"; 
  if (score <= 30) return "#4D0000"; 
  if (score <= 40) return "#330000"; 
  return "#1A0000";
};

// Tamaño según dependencia (Dep %)
// Min 25px, Max 90px para que destaque
const getNodeSize = (dep: number) => {
  return Math.max(25, Math.min(dep * 1.5, 90));
};

interface EcosystemCardProps {
  mainTicker?: string; // El ticker central (ej. AAPL)
  mainImage?: string; // URL del logo de la empresa
  suppliers?: EcoItem[];
  clients?: EcoItem[];
}

export default function EcosystemCard({ 
  mainTicker = "AAPL", 
  mainImage,
  suppliers = MOCK.prov, 
  clients = MOCK.cli 
}: EcosystemCardProps) {

  const chartOption = useMemo(() => {
    // 1. Crear Nodos
    const nodes: any[] = [];
    const links: any[] = [];
    
    // -- NODO CENTRAL --
    nodes.push({
      name: mainTicker,
      x: 0, 
      y: 0,
      symbol: mainImage ? `image://${mainImage}` : 'circle',
      symbolSize: 100, // El más grande siempre
      itemStyle: {
        color: mainImage ? "transparent" : "#ffffff", // Blanco solo si no hay imagen
        shadowBlur: 0,
        shadowColor: "transparent"
      },
      label: {
        show: !mainImage, // Mostrar texto solo si NO hay imagen
        position: "inside", 
        fontSize: 16,
        fontWeight: "bold",
        color: "#000" 
      },
      tooltip: {
        formatter: "Empresa Analizada"
      }
    });

    // -- PROVEEDORES (Izquierda) --
    suppliers.forEach((s, index) => {
      // Distribución vertical
      const spreadY = (index - (suppliers.length - 1) / 2) * 120;
      
      nodes.push({
        name: s.id,
        x: -350, // Más separación a la izquierda
        y: spreadY,
        symbolSize: getNodeSize(s.dep),
        itemStyle: {
          // AQUI SE APLICA TU HEATMAP
          color: getHeatmapColor(s.fgos), 
          borderColor: "rgba(255,255,255,0.2)",
          borderWidth: 1
        },
        label: {
          show: true,
          position: "left",
          formatter: `{b}\n${s.dep}% Dep`,
          fontSize: 10,
          color: "#9ca3af" // Gris claro
        },
        data: s 
      });

      // Link: Proveedor -> Central
      links.push({
        source: s.id,
        target: mainTicker,
        symbol: ['none', 'arrow'], // Flecha apuntando a la empresa
        lineStyle: {
          width: Math.max(1, s.dep / 15), // Grosor según dependencia
          curveness: 0,
          color: "#4b5563",
          opacity: 0.6
        }
      });
    });

    // -- CLIENTES (Derecha) --
    clients.forEach((c, index) => {
      const spreadY = (index - (clients.length - 1) / 2) * 120;

      nodes.push({
        name: c.id,
        x: 350, // Más separación a la derecha
        y: spreadY,
        symbolSize: getNodeSize(c.dep),
        itemStyle: {
          // AQUI SE APLICA TU HEATMAP
          color: getHeatmapColor(c.fgos), 
          borderColor: "rgba(255,255,255,0.2)",
          borderWidth: 1
        },
        label: {
          show: true,
          position: "right",
          formatter: `{b}\n${c.dep}% Rev`,
          fontSize: 10,
          color: "#9ca3af"
        },
        data: c
      });

      // Link: Central -> Cliente
      links.push({
        source: mainTicker,
        target: c.id,
        symbol: ['none', 'arrow'], // Flecha en el destino (Cliente)
        symbolSize: [5, 12], // Asegurar tamaño visible
        lineStyle: {
          width: Math.max(1, c.dep / 10),
          curveness: 0,
          color: "#4b5563",
          opacity: 0.6
        }
      });
    });

    return {
      backgroundColor: "transparent",
      animationDurationUpdate: 1500,
      animationEasingUpdate: 'quinticInOut',
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(20, 20, 20, 0.95)", // Tooltip ultra oscuro
        borderColor: "#333",
        textStyle: { color: "#fff" },
        formatter: (params: any) => {
          if (params.dataType === 'edge') return null;
          // Si es el nodo central
          if (params.name === mainTicker) return `<div class="font-bold px-2 py-1">${mainTicker}: Empresa Principal</div>`;
          
          const d = params.data.data as EcoItem;
          if (!d) return `<div class="font-bold">${params.name}</div>`;
          
          const scoreColor = getHeatmapColor(d.fgos); // Usar el mismo color en el tooltip
          
          return `
            <div class="text-xs p-2 min-w-[180px]">
              <div class="font-bold text-sm mb-2 flex items-center justify-between border-b border-white/10 pb-1">
                <span>${d.n} (${d.id})</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white">${d.txt}</span>
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between">
                  <span class="text-gray-400">Dependencia:</span> 
                  <span class="font-mono text-white font-bold">${d.dep}%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Salud (FGOS):</span> 
                  <span class="font-mono font-bold" style="color:${scoreColor}">${d.fgos}/100</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Ecosistema (EHS):</span> 
                  <span class="font-mono text-blue-400">${d.ehs}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Valuación:</span> 
                  <span class="font-mono text-yellow-400">${d.val}</span>
                </div>
              </div>
            </div>
          `;
        }
      },
      series: [
        {
          type: "graph",
          layout: "none", // Coordenadas manuales para el layout de "Árbol Horizontal"
          symbol: "circle",
          roam: true, // Zoom y Pan habilitados
          zoom: 0.7, // 80% más chico (20% del tamaño original)
          label: {
            show: true,
            color: "#fff"
          },
          // Flechas de flujo
          edgeSymbol: ['none', 'arrow'], 
          edgeSymbolSize: [4, 10],
          data: nodes,
          links: links,
          lineStyle: {
            opacity: 0.6,
            curveness: 0
          }
        }
      ]
    };
  }, [mainTicker, suppliers, clients]);

  // Estado vacío
  if (!suppliers.length && !clients.length) {
    return (
      <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col items-center justify-center p-6 text-gray-500">
        <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-xs">Sin datos de ecosistema disponibles</span>
      </Card>
    );
  }

  return (
    <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col">
      <CardHeader className="pb-1 pt-0 px-4 flex flex-row items-center justify-between border-b border-white/5 shrink-0">
        <CardTitle className="text-[#FFA028] text-sm flex gap-2 items-center">
          <Share2 className="w-4 h-4"/> Mapa de Ecosistema
        </CardTitle>
        <div className="flex gap-4 text-[10px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{background: "#008000"}}></div>
            Sólido
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{background: "#800000"}}></div>
            Riesgo
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full border border-gray-500 bg-transparent"></div>
            Tamaño = Dep.
          </div>
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
        {/* Etiquetas de zona flotantes */}
        <div className="absolute top-4 left-4 text-[10px] uppercase font-bold text-gray-300 tracking-[0.2em] pointer-events-none">Proveedores</div>
        <div className="absolute top-4 right-4 text-[10px] uppercase font-bold text-gray-300 tracking-[0.2em] pointer-events-none">Clientes</div>
      </CardContent>
    </Card>
  );
}