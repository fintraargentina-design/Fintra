"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface FintraStructuralProfileProps {
  ifsPosition?: "leader" | "follower" | "laggard" | "not_classified";
  ifsPressure?: number;
  sectorRank?: number;
  sectorRankTotal?: number;
  fgosBand?: "high" | "medium" | "low" | "not_classified";
  relativeValuation?: "cheap" | "fair" | "expensive" | "not_classifiable";
  attentionState?: "structural_compounder" | "quality_in_favor" | "quality_misplaced" | "structural_headwind" | "inconclusive";
}

// Helper to map valuation states to display labels
const getValuationLabel = (status?: string) => {
  if (!status || status === "not_classifiable") return "No Clasificado";
  if (status === "cheap") return "Barata vs Sector";
  if (status === "fair") return "Justa vs Sector";
  if (status === "expensive") return "Elevada vs Sector";
  return "No Clasificado";
};

// Helper to map FGOS bands to display labels
const getQualityLabel = (band?: string) => {
  if (!band || band === "not_classified") return "No Clasificado";
  if (band === "high") return "Alta Calidad";
  if (band === "medium") return "Calidad Media";
  if (band === "low") return "Baja Calidad";
  return "No Clasificado";
};

// Helper for Attention State
const getAttentionLabel = (state?: string) => {
  switch (state) {
    case "structural_compounder": return "Compounder Estructural";
    case "quality_in_favor": return "Calidad a Favor";
    case "quality_misplaced": return "Calidad Desplazada";
    case "structural_headwind": return "Viento en Contra";
    case "inconclusive": 
    default: return "Inconcluso";
  }
};

const IFSVisual = ({ 
  position, 
  pressure = 0,
  size = "md"
}: { 
  position?: string; 
  pressure?: number;
  size?: "md" | "lg";
}) => {
  const segments = Array.from({ length: 9 });
  
  // Size classes
  const segmentClass = size === "lg" 
    ? "w-2.5 h-6 rounded-[1px]" 
    : "w-1 h-2.5";
    
  const gapClass = size === "lg" ? "gap-1" : "gap-[1px]";

  if (!position || position === "not_classified") {
    return (
      <div className={cn("flex items-center", gapClass)}>
        {segments.map((_, i) => (
          <div key={i} className={cn(segmentClass, "bg-zinc-700/30")} />
        ))}
      </div>
    );
  }

  const p = Math.max(0, Math.min(9, pressure));
  let activeColorClass = "bg-zinc-500";
  
  if (position === "leader") activeColorClass = "bg-emerald-500";
  else if (position === "follower") activeColorClass = "bg-yellow-500";
  else if (position === "laggard") activeColorClass = "bg-red-500";

  return (
    <div className={cn("flex items-center", gapClass)}>
      {segments.map((_, i) => (
        <div
          key={i}
          className={cn(segmentClass, i < p ? activeColorClass : "bg-zinc-700/30")}
        />
      ))}
    </div>
  );
};

export default function FintraStructuralProfile({
  ifsPosition = "not_classified",
  ifsPressure = 0,
  sectorRank,
  sectorRankTotal,
  fgosBand = "not_classified",
  relativeValuation = "not_classifiable",
  attentionState = "inconclusive",
}: FintraStructuralProfileProps) {
  
  // Helper for IFS translation
  const getIfsLabel = (pos: string) => {
    if (pos === "leader") return "Líder";
    if (pos === "follower") return "Seguidor";
    if (pos === "laggard") return "Rezagado";
    return "No Clasificado";
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider">
          Perfil Estructural Fintra
        </h3>
        {sectorRank && sectorRankTotal ? (
          <span className="text-[10px] text-zinc-400 font-mono">
            Ranking Sectorial {sectorRank} de {sectorRankTotal}
          </span>
        ) : null}
      </div>

      {/* Level 1: Context (Dominant) */}
      <div className="flex flex-col items-center justify-center gap-3">
        <IFSVisual position={ifsPosition} pressure={ifsPressure} size="lg" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wider">
            Score Fintra de Industria
          </span>
          <span className="text-white text-base font-medium tracking-wide">
            {getIfsLabel(ifsPosition)}
          </span>
        </div>
      </div>

      {/* Level 2: Attributes (Secondary) */}
      <div className="grid grid-cols-2 gap-4 w-full pt-2">
        <div className="flex flex-col items-center text-center gap-1.5">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wider">
            Calidad Fundamental
          </span>
          <span className="text-zinc-200 text-sm font-medium">
            {getQualityLabel(fgosBand)}
          </span>
        </div>
        <div className="flex flex-col items-center text-center gap-1.5">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wider">
            Valuación Relativa
          </span>
          <span className="text-zinc-200 text-sm font-medium">
            {getValuationLabel(relativeValuation)}
          </span>
        </div>
      </div>

      {/* Level 3: Closure (Final) */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="w-16 h-[1px] bg-zinc-800/80" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wider">
            Estado Estratégico
          </span>
          <span className="text-white text-lg font-semibold tracking-wide">
            {getAttentionLabel(attentionState)}
          </span>
        </div>
      </div>
    </div>
  );
}
