import React from 'react';

interface FgosScoreCellProps {
  score: number | null | undefined;
  confidenceLabel?: string | null;
}

export const FgosScoreCell = ({ score, confidenceLabel }: FgosScoreCellProps) => {
  if (score === null || score === undefined) {
    return <span className="text-gray-500">-</span>;
  }

  // Determine color based on confidence label
  // High -> Blue (calm, reliable)
  // Medium -> Gray (neutral)
  // Low -> Muted Orange (caution, not danger)
  // Default/Missing -> Gray (Medium)

  let colorClass = "bg-slate-600/20 text-slate-300"; // Default / Medium

  const label = confidenceLabel?.toLowerCase();

  if (label === 'high') {
    colorClass = "bg-blue-500/20 text-blue-300";
  } else if (label === 'low') {
    colorClass = "bg-orange-500/20 text-orange-300";
  }

  // Common classes: rounded, centered text, padding
  // Ensuring font size and alignment identical to other numeric columns as requested
  const className = `px-2 py-0.5 rounded text-xs font-medium ${colorClass} inline-flex items-center justify-center min-w-[32px]`;

  return (
    <div className={className}>
      {Math.round(score)}
    </div>
  );
};
