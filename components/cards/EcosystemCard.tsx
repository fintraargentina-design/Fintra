"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Globe, Loader2, RefreshCw, Zap, AlertTriangle } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import * as echarts from "echarts/core";
import { SunburstChart } from "echarts/charts";
import { TooltipComponent, LegendComponent, GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// --- TIPOS (Si no los tienes en @lib/engine/types, úsalos de aquí) ---
import { EcosystemDataJSON, EcoNodeJSON } from "@/lib/engine/types";
type EcoItem = EcoNodeJSON; 

// Registrar componentes de ECharts
echarts.use([SunburstChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer]);

const ReactECharts = dynamic(() => import("echarts-for-react/lib/core"), { ssr: false });

// --- MOCK DATA (Fallback si falla la API) ---
const TSLA_MOCK_DATA = {
  mainTicker: "TSLA",
  suppliers: [
    { 
      id: "CATL", 
      n: "Contemporary Amperex Technology", 
      dep: 90, 
      health_signal: 88, 
      ehs: 35, 
      country: "CN", 
      txt: "Critical supplier of LFP batteries for Model 3/Y. High geopolitical exposure due to US-China tensions." 
    },
    { 
      id: "PANASONIC", 
      n: "Panasonic Holdings Corp", 
      dep: 75, 
      health_signal: 65, 
      ehs: 85, 
      country: "JP", 
      txt: "Long-term partner for 2170/4680 cells at Giga Nevada. Stable but facing margin pressure." 
    },
    { 
      id: "ALB", 
      n: "Albemarle Corporation", 
      dep: 60, 
      health_signal: 70, 
      ehs: 90, 
      country: "US", 
      txt: "Key lithium provider. Essential for IRA tax credit eligibility. Volatile commodity pricing impact." 
    },
    { 
      id: "NVDA", 
      n: "NVIDIA Corporation", 
      dep: 55, 
      health_signal: 98, 
      ehs: 80, 
      country: "US", 
      txt: "Crucial for AI training clusters (H100) used in FSD v12 development. High cost dependency." 
    },
    { 
      id: "IDRA", 
      n: "IDRA Group", 
      dep: 40, 
      health_signal: 50, 
      ehs: 75, 
      country: "IT", 
      txt: "Sole supplier of Giga Press die-casting machines. Single-point-of-failure risk for Cybertruck ramp." 
    },
    { 
      id: "VALE", 
      n: "Vale S.A.", 
      dep: 45, 
      health_signal: 60, 
      ehs: 55, 
      country: "BR", 
      txt: "Major nickel supplier from Canada/Brazil operations. ESG concerns regarding mining practices." 
    }
  ],
  clients: [
    { 
      id: "HERTZ", 
      n: "Hertz Global Holdings", 
      dep: 15, 
      health_signal: 30, 
      ehs: 90, 
      country: "US", 
      txt: "Major fleet customer reducing EV commitment due to repair costs. Financial health deteriorating." 
    },
    { 
      id: "PGE", 
      n: "PG&E Corporation", 
      dep: 25, 
      health_signal: 55, 
      ehs: 95, 
      country: "US", 
      txt: "Key Megapack utility partner (Moss Landing). Critical for Energy division growth." 
    },
    { 
      id: "UBER", 
      n: "Uber Technologies", 
      dep: 10, 
      health_signal: 85, 
      ehs: 90, 
      country: "US", 
      txt: "Strategic partner for driver incentives and future Robotaxi network deployment." 
    },
    { 
      id: "EU_GOV", 
      n: "European Commission", 
      dep: 20, 
      health_signal: 99, 
      ehs: 70, 
      country: "EU", 
      txt: "Regulatory credit pooling revenue source. Risk of declining value as legacy auto meets targets." 
    }
  ]
};

interface EcosystemCardProps {
  mainTicker?: string;
  suppliers?: EcoItem[];
  clients?: EcoItem[];
  data?: EcosystemDataJSON;
  loading?: boolean;
}

export default function EcosystemCard({ 
  mainTicker = "TSLA", 
  suppliers,
  clients,
  data,
  loading: initialLoading = false
}: EcosystemCardProps) {
  
  // --- STATE ---
  const [localData, setLocalData] = useState<any | null>(data || TSLA_MOCK_DATA);
  const [loading, setLoading] = useState(initialLoading);
  
  useEffect(() => {
    if (data) setLocalData(data);
  }, [data]);

  const finalSuppliers = localData?.suppliers || suppliers || [];
  const finalClients = localData?.clients || clients || [];
  
  // --- FETCHING ---
  const fetchEcosystemData = useCallback(async () => {
    if (!mainTicker) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/ecosystem/analyze?ticker=${mainTicker}`);
      if (!response.ok) throw new Error("Error fetching data");
      const result = await response.json();
      if (result.data) setLocalData(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mainTicker]);

  // Auto-fetch si no hay datos al montar
  useEffect(() => {
    const hasInitialData = (suppliers && suppliers.length > 0) || (clients && clients.length > 0);
    if (!hasInitialData && mainTicker) fetchEcosystemData();
  }, []);

  // --- CHART LOGIC (The Risk Crust Engine) ---
  const chartOption = useMemo(() => {
    
    // 1. PALETA DE COLORES (Sanitizada)
    const getColor = (score: number | undefined | null) => {
        if (score === null || score === undefined) return "#475569"; // Gris Slate (Unknown)
        if (score >= 80) return "#16a34a"; // Verde Éxito
        if (score >= 60) return "#15803d"; // Verde Oscuro
        if (score >= 40) return "#ca8a04"; // Amarillo/Ocre
        if (score >= 20) return "#991b1b"; // Rojo Oscuro
        return "#7f1d1d"; // Rojo Crítico
    };

    // 2. SANITIZACIÓN DE DATOS (Rellena huecos visuales)
    const sanitizeItem = (item: any) => {
        return {
            name: item.n || item.name || item.ticker || item.id || "Unknown",
            // Si dep es 0/null, damos un 5 visual para que el arco exista
            dep: (item.dep && item.dep > 0) ? item.dep : 5, 
            health: item.health_signal ?? item.financial_score ?? null,
            geo: item.ehs ?? item.geo_score ?? null,
            country: item.country || "??",
            txt: item.txt || "Sin análisis detallado disponible."
        };
    };

    // 3. CONSTRUCTOR DE JERARQUÍA (Recursive Builder)
    const buildChildren = (rawItems: any[]) => {
      if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) return [];

      return rawItems.map((raw) => {
        const item = sanitizeItem(raw);
        const halfVal = item.dep / 2; // Dividir valor para la corteza dual

        return {
          name: item.name, 
          // Nivel 2: Empresa (Gris neutro para destacar la corteza)
          itemStyle: { color: "#18181b", borderColor: "#000", borderWidth: 1 }, 
          children: [
            {
              name: "$", 
              value: halfVal,
              itemStyle: { color: getColor(item.health) },
              dataType: "finance", // Metadata para Tooltip
              score: item.health,
              country: item.country,
              originalItem: item
            },
            {
              name: "Geo", 
              value: halfVal,
              itemStyle: { color: getColor(item.geo) },
              dataType: "geo", // Metadata para Tooltip
              score: item.geo,
              country: item.country,
              originalItem: item
            }
          ]
        };
      });
    };

    // 4. ENSAMBLAJE DEL ÁRBOL
    const childrenSuppliers = buildChildren(finalSuppliers);
    const childrenClients = buildChildren(finalClients);
    const rootChildren = [];

    // Lógica para ramas vacías (Placeholders para mantener forma circular)
    if (childrenSuppliers.length > 0) {
        rootChildren.push({
            name: "Proveedores",
            itemStyle: { color: "#1F3A5F" }, // Amarillo
            children: childrenSuppliers
        });
    } else {
        rootChildren.push({
            name: "No Data",
            value: 5,
            itemStyle: { color: "#535357ff", opacity: 0.2 },
            children: []
        });
    }

    if (childrenClients.length > 0) {
        rootChildren.push({
            name: "Clientes",
            itemStyle: { color: "#D9822B" }, // Azul
            children: childrenClients
        });
    }

    const sunburstData = [{
      name: mainTicker,
      itemStyle: { color: "#FFA028" }, // Naranja Fintra
      children: rootChildren
    }];

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(9, 9, 11, 0.95)",
        borderColor: "#27272a",
        textStyle: { color: "#fff" },
        confine: true, // Evita que se salga de la pantalla
        formatter: (params: any) => {
          const d = params.data;
          // Mostrar tooltip solo en la corteza (Nivel 3) o Empresa (Nivel 2)
          if (!d || !d.dataType) return null; 

          const isGeo = d.dataType === 'geo';
          const title = isGeo ? "Riesgo Geopolítico" : "Salud Financiera";
          const score = d.score;
          const scoreDisplay = score !== null ? `${score}/100` : "N/A";
          const color = getColor(score);
          const isCritical = score !== null && score <= 30;
          
          return `
             <div class="font-sans text-xs min-w-[200px]">
               <div class="px-3 py-2 border-b border-white/10 flex justify-between items-center font-bold ${isCritical ? 'bg-red-900/20 text-red-200' : ''}">
                 <span class="flex items-center gap-2">
                    <span class="bg-white/10 px-1 rounded text-[9px] font-mono">${d.country}</span>
                    ${d.originalItem.name}
                 </span>
                 ${isCritical ? '<span class="text-[9px] bg-red-600 px-1 rounded text-white">ALERTA</span>' : ''}
               </div>
               <div class="p-3">
                 <div class="flex justify-between items-center mb-2">
                   <span class="text-zinc-400">${title}</span>
                   <span class="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style="background:${color}">
                     ${scoreDisplay}
                   </span>
                 </div>
                 <p class="text-[10px] text-zinc-500 italic leading-snug border-l-2 border-zinc-700 pl-2">
                   "${d.originalItem.txt}"
                 </p>
               </div>
             </div>
          `;
        }
      },
      series: {
        type: "sunburst",
        data: sunburstData,
        radius: [0, "90%"],
        sort: undefined, // undefined mantiene orden de entrada (mejor para agrupar)
        emphasis: { focus: "ancestor" },
        levels: [
          // Nivel 0: Ticker (Centro)
          { r0: 0, r: "15%", itemStyle: { borderWidth: 2 }, label: { fontWeight: "bold", color: "#000", fontSize: 12 } },
          // Nivel 1: Categoría (Supply/Revenue)
          { r0: "15%", r: "25%", itemStyle: { borderWidth: 2 }, label: { rotate: "tangential", fontSize: 10, color: "#fff", fontWeight: "bold" } },
          // Nivel 2: Empresa (Nombre)
          { r0: "25%", r: "40%", itemStyle: { borderWidth: 1 }, label: { rotate: "tangential", align: "center", color: "#fff", fontSize: 9 } },
          // Nivel 3: Corteza (Risk Crust)
          { 
            r0: "41%", r: "67%", 
            itemStyle: { borderWidth: 0.5 }, 
            label: { 
                rotate: "tangential", 
                minAngle: 5, // Ocultar si es muy fino para evitar ruido
                fontSize: 8, 
                color: "#fff",
                formatter: (p: any) => p.name 
            } 
          }
        ]
      }
    };
  }, [mainTicker, finalSuppliers, finalClients]);

  // --- RENDERING ---
  const hasData = (finalSuppliers && finalSuppliers.length > 0) || (finalClients && finalClients.length > 0);

  // Estado: Empty
  if (!loading && !hasData) {
    return (
      <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col items-center justify-center p-6 text-gray-500">
        <Globe className="w-12 h-12 mb-4 opacity-20" />
        <h3 className="text-sm font-medium mb-2">Sin datos de ecosistema</h3>
        <Button onClick={fetchEcosystemData} variant="outline" className="border-zinc-700 text-zinc-400">
            <Zap className="w-4 h-4 mr-2" /> Analizar con IA
        </Button>
      </Card>
    );
  }

  return (
    <Card className="bg-tarjetas border-none shadow-lg h-full flex flex-col group relative overflow-hidden">
      {/* Loading Overlay */}
      {loading && hasData && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center text-white/80">
           <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-400" />
           <span className="text-xs font-medium tracking-wider">ACTUALIZANDO...</span>
        </div>
      )}

      <CardHeader className="p-0 m-0 space-y-0 shrink-0 w-full border-b border-zinc-800 bg-transparent z-10">
        <div className="flex items-center justify-between w-full h-10 px-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">Ecosystem Risk Map</span>
            <Button
              variant="ghost" size="icon" onClick={fetchEcosystemData} disabled={loading}
              className="h-6 w-6 text-zinc-500 hover:text-zinc-200"
            >
               <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {/* Leyenda Compacta */}
          <div className="flex gap-3 text-[9px] text-zinc-500 uppercase tracking-wider font-medium">
             <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Supply</div>
             <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Revenue</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-[350px] relative bg-gradient-to-b from-transparent to-black/20">
        {loading && !hasData ? (
             <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs">Cargando análisis...</span>
             </div>
        ) : (
             <ReactECharts 
               echarts={echarts}
               option={chartOption} 
               style={{ height: '100%', width: '100%' }}
               opts={{ renderer: 'canvas' }}
             />
        )}

        {/* Leyenda de Corteza (Flotante) */}
        <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1 text-[8px] text-zinc-600 bg-black/40 p-2 rounded border border-white/5 backdrop-blur-sm pointer-events-none">
            <span className="uppercase font-bold text-zinc-400 mb-0.5">Risk Crust (Borde)</span>
            <div className="flex items-center gap-1"><span className="text-xs">💲</span> Salud Financiera</div>
            <div className="flex items-center gap-1"><span className="text-xs">🌍</span> Riesgo Geopolítico</div>
        </div>
      </CardContent>
    </Card>
  );
}