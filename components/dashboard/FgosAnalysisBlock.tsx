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

  let displayScore: string | number = "N/A";
  let displayConfidence = "Low (0%)";
  let displayStatus = "Pending";
  let displayVerdict = "N/A";
  let displayNarrative = "Insufficient data.";

  if (fgosState) {
    // --- New Path (Canonical State) ---
    displayScore = fgosState.quality.score !== null ? fgosState.quality.score : "N/A";
    
    displayConfidence = `${fgosState.confidence.label} (${Math.round(fgosState.confidence.percent)}%)`;
    
    // Format stage: pending -> PENDING, partial -> PARTIAL
    displayStatus = fgosState.stage.toUpperCase();
    
    // Map bucket to Verdict-like string
    displayVerdict = fgosState.quality.bucket !== 'unknown' 
      ? fgosState.quality.bucket.toUpperCase() 
      : "N/A";

    displayNarrative = fgosState.explanation;

  } else {
    // --- Legacy Path (Inference) ---
    // TODO: Remove this block once all consumers use fgosState
    if (fgosScore == null) return null;

    // 1. Normalize Status
    const status = fgosStatus || "Incomplete";
    const label = confidenceLabel || "Low"; 
    const percent = typeof confidencePercent === 'number' ? `${Math.round(confidencePercent)}%` : "N/A";

    displayScore = fgosScore;
    displayConfidence = `${label} (${percent})`;
    displayStatus = status;

    // 2. Verdict Derivation
    const getVerdict = (s: string) => {
      switch (s) {
        case "Mature": return "Actionable";
        case "Developing": return "Use with caution";
        case "Early-stage": return "Informational only";
        case "Incomplete": return "Not comparable";
        default: return "Not comparable";
      }
    };
    displayVerdict = getVerdict(status);

    // 3. Narrative Copy
    const getNarrative = (s: string) => {
      switch (s) {
        case "Mature":
          return "The company exhibits strong and consistent business quality across multiple financial cycles. The FGOS score is considered highly reliable.";
        case "Developing":
          return "The company shows solid business fundamentals, though some metrics lack long-term consistency. The FGOS assessment should be interpreted with moderate confidence.";
        case "Early-stage":
          return "The business demonstrates promising operational quality, but its public financial history is too short to reliably assess long-term performance. This FGOS score should be considered informational.";
        case "Incomplete":
          return "Insufficient or missing financial data prevents a reliable FGOS assessment at this time.";
        default:
          return "Insufficient or missing financial data prevents a reliable FGOS assessment at this time.";
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
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Business Quality</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">{displayScore} / 100</TableCell>
              </TableRow>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Confidence</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">
                  {displayConfidence}
                </TableCell>
              </TableRow>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">FGOS Status</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">{displayStatus}</TableCell>
              </TableRow>
              <TableRow className="border-none hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Verdict</TableCell>
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
