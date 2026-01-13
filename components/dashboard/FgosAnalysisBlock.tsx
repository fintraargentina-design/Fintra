import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface FgosAnalysisBlockProps {
  fgosScore: number | null;
  confidenceLabel: string | null;
  confidencePercent: number | null;
  fgosStatus: string | null;
}

export default function FgosAnalysisBlock({
  fgosScore,
  confidenceLabel,
  confidencePercent,
  fgosStatus
}: FgosAnalysisBlockProps) {
  if (fgosScore === null) return null;

  // 1. Normalize Status
  // DB might have "Mature", "Developing", etc. 
  // Map safely.
  const status = fgosStatus || "Incomplete";
  const label = confidenceLabel || "Low"; // Fallback
  const percent = confidencePercent !== null ? `${Math.round(confidencePercent)}%` : "N/A";

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

  const verdict = getVerdict(status);

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

  const narrative = getNarrative(status);

  return (
    <div className="w-full mt-4 border-t border-zinc-800 pt-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-3">FGOS Analysis</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
        {/* Summary Table */}
        <div className="border border-zinc-800 rounded-md overflow-hidden bg-zinc-900/30">
          <Table>
            <TableBody>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Business Quality</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">{fgosScore} / 100</TableCell>
              </TableRow>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Confidence</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">
                  {label} <span className="text-zinc-500">({percent})</span>
                </TableCell>
              </TableRow>
              <TableRow className="border-zinc-800/50 hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">FGOS Status</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-mono">{status}</TableCell>
              </TableRow>
              <TableRow className="border-none hover:bg-transparent">
                <TableCell className="py-2 text-xs text-zinc-500 font-medium">Verdict</TableCell>
                <TableCell className="py-2 text-xs text-zinc-200 text-right font-medium">{verdict}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Narrative */}
        <div className="flex items-center">
            <p className="text-sm text-zinc-400 leading-relaxed italic border-l-2 border-zinc-700 pl-4 py-1">
              "{narrative}"
            </p>
        </div>
      </div>
    </div>
  );
}
