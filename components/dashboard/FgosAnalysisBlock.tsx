import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { FgosState } from '@/lib/engine/fgos-state';

interface FgosAnalysisBlockProps {
  fgosState?: FgosState | null;
  // Legacy props (kept for backward compatibility)
  fgosScore?: number | null;
  confidenceLabel?: string | null;
  confidencePercent?: number | null;
  fgosStatus?: string | null;
}

export default function FgosAnalysisBlock({
  fgosState,
  fgosScore,
  confidenceLabel,
  confidencePercent,
  fgosStatus
}: FgosAnalysisBlockProps) {
  // Render Guard: Must have either new state or legacy score
  if (!fgosState && fgosScore === null) return null;

  let displayScore: string | number = "N/D";
  let displayConfidence = "Baja (0%)";
  let displayStatus = "Pendiente";
  let displayVerdict = "N/D";
  let displayNarrative = "Datos insuficientes.";

  if (fgosState) {
    // --- New Path (Canonical State) ---
    displayScore = fgosState.quality.score !== null ? fgosState.quality.score : "N/D";
    
    // Translate confidence label
    const confLabel = fgosState.confidence.label === 'High' ? 'Alta' 
      : fgosState.confidence.label === 'Medium' ? 'Media' 
      : 'Baja';
    displayConfidence = `${confLabel} (${Math.round(fgosState.confidence.percent)}%)`;
    
    // Format stage: pending -> PENDING, partial -> PARTIAL
    displayStatus = fgosState.stage.toUpperCase();
    if (displayStatus === 'PENDING') displayStatus = 'PENDIENTE';
    if (displayStatus === 'PARTIAL') displayStatus = 'PARCIAL';
    if (displayStatus === 'COMPUTED') displayStatus = 'CALCULADO';
    
    // Map bucket to Verdict-like string
    const bucketMap: Record<string, string> = {
      'elite': 'ELITE',
      'strong': 'FUERTE',
      'average': 'PROMEDIO',
      'weak': 'DÉBIL',
      'unknown': 'N/D'
    };
    displayVerdict = bucketMap[fgosState.quality.bucket] || "N/D";

    displayNarrative = fgosState.explanation;

  } else {
    // --- Legacy Path (Inference) ---
    // TODO: Remove this block once all consumers use fgosState
    if (fgosScore == null) return null;

    // 1. Normalize Status
    const status = fgosStatus || "Incomplete";
    const label = confidenceLabel || "Low"; 
    const translatedLabel = label === 'High' ? 'Alta' : label === 'Medium' ? 'Media' : 'Baja';
    const percent = typeof confidencePercent === 'number' ? `${Math.round(confidencePercent)}%` : "N/D";

    displayScore = fgosScore;
    displayConfidence = `${translatedLabel} (${percent})`;
    displayStatus = status;

    // 2. Verdict Derivation
    const getVerdict = (s: string) => {
      switch (s) {
        case "Mature": return "Accionable";
        case "Developing": return "Usar con precaución";
        case "Early-stage": return "Solo informativo";
        case "Incomplete": return "No comparable";
        default: return "No comparable";
      }
    };
    displayVerdict = getVerdict(status);

    // 3. Narrative Copy
    const getNarrative = (s: string) => {
      switch (s) {
        case "Mature":
          return "La empresa muestra una calidad fundamental sólida y consistente a través de múltiples ciclos financieros. El score FGOS se considera altamente confiable.";
        case "Developing":
          return "La empresa muestra fundamentos de negocio sólidos, aunque algunas métricas carecen de consistencia a largo plazo. La evaluación FGOS debe interpretarse con confianza moderada.";
        case "Early-stage":
          return "El negocio demuestra una calidad operativa prometedora, pero su historia financiera pública es demasiado corta para evaluar el rendimiento a largo plazo de manera confiable. Este score FGOS debe considerarse informativo.";
        case "Incomplete":
          return "La falta de datos financieros impide una evaluación FGOS confiable en este momento.";
        default:
          return "La falta de datos financieros impide una evaluación FGOS confiable en este momento.";
      }
    };
    displayNarrative = getNarrative(status);
  }

  return (
    <div className="w-full mt-4 border-t border-zinc-800 pt-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">Análisis IFS</h3>
      
      <div className="flex flex-col gap-4">
        {/* Summary Table */}
        <div className="border border-zinc-800 rounded-md overflow-hidden bg-zinc-900/30">
          <div className="flex items-center justify-between p-3 divide-x divide-zinc-800/50">
            <div className="flex flex-col items-center flex-1 px-2">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">Confianza</span>
              <span className="text-xs text-zinc-200 font-mono">{displayConfidence}</span>
            </div>
            
            <div className="flex flex-col items-center flex-1 px-2">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">Estado FGOS</span>
              <span className="text-xs text-zinc-200 font-mono">{displayStatus}</span>
            </div>

            <div className="flex flex-col items-center flex-1 px-2">
              <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">Veredicto</span>
              <span className="text-xs text-zinc-200 font-medium">{displayVerdict}</span>
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div className="flex items-center">
            <p className="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-zinc-700 pl-4 py-1">
              "{displayNarrative}"
            </p>
        </div>
      </div>
    </div>
  );
}
