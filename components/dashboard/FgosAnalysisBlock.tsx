import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
      
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
        {/* Summary Table */}
        <div className="border border-zinc-800 rounded-md overflow-hidden bg-zinc-900/30">
          <Table>
            <TableBody>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Calidad Fundamental</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">{displayScore} / 100</TableCell>
              </TableRow>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Confianza</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">
                  {displayConfidence}
                </TableCell>
              </TableRow>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Estado FGOS</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">{displayStatus}</TableCell>
              </TableRow>
              <TableRow className="border-none hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Veredicto</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-medium">{displayVerdict}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
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
