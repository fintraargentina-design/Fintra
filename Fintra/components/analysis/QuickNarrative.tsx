
"use client";

import React, { useState } from "react";
import { NarrativeAnchor } from "@/lib/analysis/narrativeAnchors";
import { NarrativeDrift } from "@/lib/analysis/narrativeDrift";
import { Locale } from "@/lib/i18n/types";
import { resolveNarrativeText, resolveTemporalHint } from "@/lib/i18n/resolveNarrative";
import { CheckCircle2, AlertTriangle, Info, AlertOctagon } from "lucide-react";

interface QuickNarrativeProps {
  anchors: NarrativeAnchor[];
  onHighlight: (metrics: string[] | null) => void;
  drift?: NarrativeDrift | null;
  locale?: Locale;
}

export default function QuickNarrative({ anchors, onHighlight, drift, locale = 'es' }: QuickNarrativeProps) {
  const [fixedHighlight, setFixedHighlight] = useState<string | null>(null);

  if (!anchors || anchors.length === 0) return null;

  const displayAnchors = anchors.slice(0, 5);

  const getIcon = (tone: string) => {
    switch (tone) {
      case "positive": return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case "warning": return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
      case "negative": return <AlertOctagon className="w-3.5 h-3.5 text-red-400" />;
      default: return <Info className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getToneClass = (tone: string, isActive: boolean) => {
      const base = "transition-all duration-200 border cursor-pointer select-none";
      if (isActive) {
          switch(tone) {
              case "positive": return `${base} bg-emerald-500/10 border-emerald-500/50 text-emerald-300`;
              case "warning": return `${base} bg-yellow-500/10 border-yellow-500/50 text-yellow-300`;
              case "negative": return `${base} bg-red-500/10 border-red-500/50 text-red-300`;
              default: return `${base} bg-blue-500/10 border-blue-500/50 text-blue-300`;
          }
      }
      // Inactive
      return `${base} bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700`;
  };

  const handleMouseEnter = (anchor: NarrativeAnchor) => {
    if (!fixedHighlight) {
      onHighlight(anchor.highlight);
    }
  };

  const handleMouseLeave = () => {
    if (!fixedHighlight) {
      onHighlight(null);
    }
  };

  const handleClick = (anchor: NarrativeAnchor) => {
    if (fixedHighlight === anchor.id) {
      // Toggle off
      setFixedHighlight(null);
      onHighlight(anchor.highlight); // Keep hover effect or clear? 
      // Requirement: "Segundo click → libera"
      onHighlight(null); // Clear highlight on toggle off
    } else {
      setFixedHighlight(anchor.id);
      onHighlight(anchor.highlight);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5 px-1 py-2 bg-transparent">
      {drift && (
        <div className="px-1">
           <span className="text-zinc-500 text-xs italic">{drift.message}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
         <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Lectura rápida</h4>
         <div className="h-[1px] flex-1 bg-zinc-800/50"></div>
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        {displayAnchors.map((anchor) => {
           const isActive = fixedHighlight === anchor.id;
           
           return (
             <div
               key={anchor.id}
               className={`
                flex items-center gap-1.5 px-2 py-1 rounded text-[11px] 
                ${anchor.dominance === 'primary' ? 'font-semibold' : 'font-medium'}
                ${getToneClass(anchor.tone, isActive)}
              `}
               onMouseEnter={() => handleMouseEnter(anchor)}
               onMouseLeave={handleMouseLeave}
               onClick={() => handleClick(anchor)}
             >
               {getIcon(anchor.tone)}
               <span>
                 {resolveNarrativeText(anchor, locale)}
                 {anchor.temporal_hint && (
                    <span className="text-zinc-500 font-normal ml-1">
                      ({resolveTemporalHint(anchor.temporal_hint, locale)})
                    </span>
                  )}
                  {anchor.dominance === 'primary' && (
                    <span className="text-zinc-600 font-normal ml-1 uppercase text-[9px] tracking-tight">(key)</span>
                  )}
               </span>
             </div>
           );
        })}
      </div>
    </div>
  );
}
