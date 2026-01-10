import React from 'react';
import { DecisionAnchor } from '@/lib/analysis/decisionAnchors';
import { CheckCircle, AlertTriangle, Info, Scale } from 'lucide-react';

interface DecisionReadProps {
  anchors: DecisionAnchor[];
}

const iconMap = {
  "check-circle": CheckCircle,
  "alert-triangle": AlertTriangle,
  "info": Info,
  "scale": Scale
};

const toneColors = {
  positive: "text-green-400 bg-green-400/10 border-green-400/20",
  warning: "text-[#FFA028] bg-[#FFA028]/10 border-[#FFA028]/20",
  neutral: "text-blue-400 bg-blue-400/10 border-blue-400/20"
};

export default function DecisionRead({ anchors }: DecisionReadProps) {
  if (!anchors || anchors.length === 0) return null;

  return (
    <div className="w-full mb-1">
      <div className="flex items-center gap-2 mb-1 px-1">
        <h3 className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
          Lectura de decisión
        </h3>
        <div className="h-px flex-1 bg-zinc-800/50" />
      </div>
      
      <div className="flex flex-wrap gap-2 px-1">
        {anchors.map((anchor) => {
          const Icon = iconMap[anchor.iconName] || Info;
          const colorClass = toneColors[anchor.tone] || toneColors.neutral;
          
          return (
            <div 
              key={anchor.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border ${colorClass} backdrop-blur-sm`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">
                {anchor.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
