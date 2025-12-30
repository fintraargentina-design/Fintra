"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, Globe, Wallet, AlertCircle, Loader2, RefreshCw, Zap } from "lucide-react"; 
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"; 
import { Button } from "@/components/ui/button";
import * as echarts from "echarts/core";
import { GraphChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Registrar componentes de ECharts
echarts.use([GraphChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

import { EcosystemDataJSON, EcoNodeJSON } from "@/lib/engine/types";

// Reutilizamos EcoNodeJSON pero añadimos country opcional si no está
// O simplemente usamos EcoNodeJSON directamente
type EcoItem = EcoNodeJSON;

// --- MOCK DATA: APPLE FORENSIC ANALYSIS (Basado en Reporte Fintra) ---
const APPLE_MOCK_DATA = {
  mainTicker: "AAPL",
  suppliers: [
    { 
      id: "TSM", 
      n: "TSMC", 
      country: "TW", 
      dep: 100, 
      market_sentiment: 90, 
      ehs: 95, 
      health_signal: 92, 
      txt: "Punto Único de Falla / Riesgo Invasión" 
    },
    { 
      id: "FOX", 
      n: "Foxconn", 
      country: "CN", 
      dep: 60, 
      market_sentiment: 50, 
      ehs: 60, 
      health_signal: 55, 
      txt: "Dependencia Crítica de China" 
    },
    { 
      id: "TATA", 
      n: "Tata Electronics", 
      country: "IN", 
      dep: 25, 
      market_sentiment: 65, 
      ehs: 70, 
      health_signal: 60, 
      txt: "Diversificación 'China Plus One'" 
    },
    { 
      id: "SSNLF", 
      n: "Samsung Elec", 
      country: "KR", 
      dep: 70, 
      market_sentiment: 75, 
      ehs: 80, 
      health_signal: 82, 
      txt: "Oligopolio Memoria y Pantallas" 
    },
    { 
      id: "GLW", 
      n: "Corning", 
      country: "US", 
      dep: 40, 
      market_sentiment: 55, 
      ehs: 85, 
      health_signal: 72,  
      txt: "Monopolio 'Ceramic Shield'" 
    }
  ],
  clients: [
    { 
      id: "GOOGL", 
      n: "Alphabet (Google)", 
      country: "US", 
      dep: 20, 
      market_sentiment: 85, 
      ehs: 90, 
      health_signal: 95, 
      txt: "Riesgo Regulatorio (DOJ) $20MM/año" 
    },
    { 
      id: "CHN", 
      n: "China Market", 
      country: "CN", 
      dep: 19, 
      market_sentiment: 40, 
      ehs: 50, 
      health_signal: 40, 
      txt: "Nacionalismo / Erosión de Cuota" 
    },
    { 
      id: "USA", 
      n: "USA Market", 
      country: "US", 
      dep: 42, 
      market_sentiment: 80, 
      ehs: 95, 
      health_signal: 90, 
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
  data?: EcosystemDataJSON; // Nueva prop opcional para JSON completo
  loading?: boolean; // Estado de carga/regeneración
}

export default function EcosystemCard({ 
  mainTicker = APPLE_MOCK_DATA.mainTicker, 
  mainImage,
  suppliers,
  clients,
  data,
  loading: initialLoading = false
}: EcosystemCardProps) {
  
  // --- LOCAL STATE MANAGEMENT ---
  const [localData, setLocalData] = useState<EcosystemDataJSON | null>(data || null);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);
  
  // Sincronizar props con estado local si cambian externamente
  useEffect(() => {
    if (data) setLocalData(data);
  }, [data]);

  // Normalizar datos: Usar estado local, props directas.
  // ELIMINADO FALLBACK A MOCK para permitir estado vacío
  const finalSuppliers = localData?.suppliers || suppliers || [];
  const finalClients = localData?.clients || clients || [];
  
  // Estado para controlar la "Lente" de visión (Financiera vs Geopolítica)
  const [viewMode, setViewMode] = useState<"financial" | "geopolitical">("financial");

  // --- FETCHING LOGIC ---
  const fetchEcosystemData = useCallback(async () => {
    if (!mainTicker) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/ecosystem/analyze?ticker=${mainTicker}`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) throw new Error(result.error);
      
      if (result.data) {
        setLocalData(result.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch ecosystem data:", err);
      setError(err.message || "Error al actualizar datos");
    } finally {
      setLoading(false);
    }
  }, [mainTicker]);

  // Auto-fetch on mount if no data provided
  useEffect(() => {
    const hasInitialData = (suppliers && suppliers.length > 0) || (clients && clients.length > 0) || (data?.suppliers && data.suppliers.length > 0);
    if (!hasInitialData && mainTicker) {
      fetchEcosystemData();
    }
  }, []); // Run once on mount

  const chartOption = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];
    
    // 1. NODO CENTRAL
    nodes.push({
      name: mainTicker,
      x: 0, y: 0,
      symbol: 'circle',
      symbolSize: 80,
      itemStyle: {
        color: "#FFA028",
        shadowBlur: 15,
        shadowColor: viewMode === 'geopolitical' ? "#3b82f6" : "rgba(255,255,255,0.3)"
      },
      label: { show: true, position: "inside", fontSize: 16, fontWeight: "bold", color: "#000", formatter: '{b}' },
      tooltip: { formatter: `<div class="font-bold px-2 text-center text-sm">${mainTicker}</div>` }
    });

    // 2. HELPER PARA PROCESAR NODOS
    const processNodes = (items: EcoItem[], isSupplier: boolean) => {
      // Manejar caso items undefined
      if (!items || !Array.isArray(items)) return;

      items.forEach((item, index) => {
        // Distribución vertical calculada para centrar los nodos
        const spreadY = (index - (items.length - 1) / 2) * 120;
        const xPos = isSupplier ? -350 : 350;

        // Determinar qué score usar (Switch Lógico)
        // Usamos EHS como principal indicador de color ahora, fallback a health_signal o geo_score legacy
        // Si existe 'ehs' (nuevo modelo), lo usamos. Si no, fallback.
        const activeScore = item.ehs ?? (viewMode === 'financial' ? item.health_signal : 50);
        
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

    processNodes(finalSuppliers, true);
    processNodes(finalClients, false);

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
          const scoreLabel = "Ecosystem Health";
          const scoreValue = d.ehs ?? d.health_signal ?? 50;
          const scoreColor = getHeatmapColor(scoreValue);
          
          // Alerta visual en el header del tooltip
          const isHighRisk = scoreValue <= 40;
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
                   <div class="text-[10px] italic text-gray-500 leading-tight">"${d.txt}"</div>
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
        zoom: 0.7, // Ajustado a 0.7 según requerimientos anteriores
        label: { show: true, color: "#fff" },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [4, 10],
        data: nodes,
        links: links
      }]
    };
  }, [mainTicker, finalSuppliers, finalClients, viewMode, mainImage]);

  // Estado de Carga Inicial (Sin datos)
  const hasData = (finalSuppliers && finalSuppliers.length > 0) || (finalClients && finalClients.length > 0);

  if (loading && !hasData) {
    return (
      <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col items-center justify-center p-6 text-gray-500">
        <Loader2 className="w-10 h-10 mb-3 text-blue-500 animate-spin" />
        <span className="text-sm font-medium animate-pulse">Analizando Ecosistema con IA...</span>
        <span className="text-xs text-gray-600 mt-2">Esto puede tomar unos segundos</span>
      </Card>
    );
  }

  // Estado vacío (Sin datos y sin carga)
  if (!hasData) {
    return (
      <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col items-center justify-center p-6 text-gray-500">
        <Globe className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-sm font-medium mb-2">Sin datos de ecosistema</h3>
        <p className="text-xs text-gray-500 text-center max-w-[200px] mb-4">
          No hay información disponible para {mainTicker}. Puedes solicitar un análisis con IA.
        </p>
        <Button 
          onClick={fetchEcosystemData}
          disabled={loading}
          variant="outline"
          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generar Ecosistema con IA
            </>
          )}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col group relative overflow-hidden">
      {/* Loading Overlay (Regenerating) */}
      {loading && hasData && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center text-white/80">
           <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-400" />
           <span className="text-xs font-medium tracking-wider">ACTUALIZANDO...</span>
        </div>
      )}

      <CardHeader className="p-0 m-0 space-y-0 shrink-0 w-full border-b border-zinc-800 bg-transparent z-10">
        <div className="flex items-center justify-between w-full">
          {/* Título y Botón Refresh */}
          <div className="flex items-center gap-2 pl-2">
            <span className="text-xs font-medium text-zinc-400">Mapa Ecosistema</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchEcosystemData}
              disabled={loading}
              className="h-5 w-5 text-zinc-500 hover:text-zinc-200"
              title="Actualizar análisis"
            >
               <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* --- TOGGLE DE LENTES (Estilo ChartsTab) --- */}
          <div className="flex gap-0.5">
            <button
              onClick={() => setViewMode('financial')}
              className={`
                rounded-none border-b-2 px-2 py-1 text-xs transition-colors font-medium flex items-center gap-1.5
                ${
                  viewMode === 'financial'
                    ? 'bg-[#0056FF] text-white border-[#0056FF]'
                    : 'bg-zinc-900 border-black text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                }
              `}
            >
              <Wallet className="w-3 h-3" /> Finanzas
            </button>
            <button
              onClick={() => setViewMode('geopolitical')}
              className={`
                rounded-none border-b-2 px-2 py-1 text-xs transition-colors font-medium flex items-center gap-1.5
                ${
                  viewMode === 'geopolitical'
                    ? 'bg-[#0056FF] text-white border-[#0056FF]'
                    : 'bg-zinc-900 border-black text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'
                }
              `}
            >
              <Globe className="w-3 h-3" /> Geopolítica
            </button>
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