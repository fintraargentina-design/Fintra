import React from 'react';
import { CanonicalValuationState } from '@/lib/repository/fintra-db';

interface SectorValuationBlockProps {
  valuation?: CanonicalValuationState | null;
}

export default function SectorValuationBlock({ valuation }: SectorValuationBlockProps) {
  // Safety Rules: If valuation or valuation.stage is missing
  if (!valuation || !valuation.stage) {
    return (
      <div className="w-full mt-4 border-t border-zinc-800 pt-4">
        <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider mb-3">
          Valuación Relativa del Sector
        </h3>
        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
          <span className="text-zinc-400 text-xs">
            Valuación relativa al sector no disponible
          </span>
        </div>
      </div>
    );
  }

  // 3. Status Label Mapping
  const getStatusText = (status: string) => {
    switch (status) {
      case 'cheap_sector': return "Cotiza con descuento frente a su sector";
      case 'fair_sector': return "Cotiza en línea con su sector";
      case 'expensive_sector': return "Cotiza con prima frente a su sector";
      case 'pending': return "Valuación sectorial no disponible";
      default: return "Valuación sectorial no disponible";
    }
  };

  // 2. Color Mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cheap_sector': return "bg-green-500 text-green-400";
      case 'fair_sector': return "bg-yellow-500 text-yellow-400";
      case 'expensive_sector': return "bg-red-500 text-red-400";
      case 'pending': return "bg-gray-500 text-gray-400";
      default: return "bg-gray-500 text-gray-400";
    }
  };

  const statusText = getStatusText(valuation.canonical_status);
  const colorClass = getStatusColor(valuation.canonical_status);
  
  // Extract background color for the dot (first part of colorClass)
  const dotColor = colorClass.split(' ')[0];
  // Extract text color for the label (second part)
  const textColor = colorClass.split(' ')[1];

  return (
    <div className="w-full mt-4 border-t border-zinc-800 pt-4">
      {/* 1. Title */}
      <h3 className="text-[#FFA028] text-xs font-bold uppercase tracking-wider mb-3">
        Valuación Relativa del Sector
      </h3>

      <div className="flex flex-col gap-3">
        {/* 2. Thermometer / Indicator & 3. Status Label */}
        <div className="p-3 bg-zinc-900/30 border border-zinc-800 rounded flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <span className={`text-sm font-medium ${textColor}`}>
              {statusText}
            </span>
          </div>
          
          {/* 4. Confidence Display */}
          <div className="text-[10px] text-zinc-500 pl-4.5">
            Confianza: {valuation.confidence.label} ({Math.round(valuation.confidence.percent)}%)
          </div>
        </div>

        {/* 5. Explanation Text */}
        <div className="text-zinc-400 text-xs leading-relaxed text-justify font-mono">
          {valuation.explanation}
        </div>
      </div>
    </div>
  );
}
