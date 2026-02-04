import React from "react";
import { PeerContrast } from "@/lib/analysis/decisionPeerContrast";

interface DecisionPeerContrastProps {
  contrasts: PeerContrast[] | null;
  peerTicker: string | null;
}

export default function DecisionPeerContrast({ contrasts, peerTicker }: DecisionPeerContrastProps) {
  if (!contrasts || contrasts.length === 0 || !peerTicker) {
    return null;
  }

  const getToneColor = (tone: PeerContrast["tone"]) => {
    switch (tone) {
      case "positive": return "bg-emerald-500";
      case "warning": return "bg-amber-500";
      case "negative": return "bg-red-500";
      case "neutral": return "bg-blue-400";
      default: return "bg-zinc-500";
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-2 border-t border-zinc-800/50 pt-2 px-3 pb-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
          Contrast vs {peerTicker}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {contrasts.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <div className={`w-1 h-3 mt-1 rounded-full shrink-0 ${getToneColor(c.tone)}`} />
            <span className="text-xs text-zinc-300 font-medium leading-tight">
              {c.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
