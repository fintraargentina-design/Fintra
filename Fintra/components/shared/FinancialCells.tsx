import React from "react";
import { AlertTriangle, ArrowUp, ArrowDown, Minus } from "lucide-react";

export const ValuationSignal = ({ status }: { status: string | null }) => {
  if (!status) return <div className="w-5 h-4" />;

  const lower = status.toLowerCase();
  let colorClass = "bg-zinc-800";
  let activeBars = 0;

  // 5-State Valuation System
  if (
    lower.includes("very") &&
    (lower.includes("cheap") || lower.includes("undervalued"))
  ) {
    colorClass = "bg-[#10b981]"; // Green - Very Cheap
    activeBars = 5;
  } else if (lower.includes("cheap") || lower.includes("undervalued")) {
    colorClass = "bg-[#1ee3cf]"; // Cyan - Cheap
    activeBars = 4;
  } else if (lower.includes("fair")) {
    colorClass = "bg-[#f5a623]"; // Orange - Fair
    activeBars = 3;
  } else if (lower.includes("expensive") || lower.includes("overvalued")) {
    // Check if "very expensive"
    if (lower.includes("very")) {
      colorClass = "bg-[#dc2626]"; // Dark Red - Very Expensive
      activeBars = 1;
    } else {
      colorClass = "bg-[#ff6b6b]"; // Red - Expensive
      activeBars = 2;
    }
  }

  return (
    <div className="flex items-end gap-[1px] h-3.5 w-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-[2px] rounded-[1px] transition-all duration-300 ${
            i <= activeBars ? colorClass : "bg-[#333]"
          }`}
          style={{
            height: `${i === 1 ? "30%" : i === 2 ? "45%" : i === 3 ? "60%" : i === 4 ? "80%" : "100%"}`,
            opacity: i <= activeBars ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
};

export const FGOSCell = ({
  score,
  status,
  sentiment,
  band,
  hasPenalty,
}: {
  score: number | null | undefined;
  status: string | null | undefined;
  sentiment: string | null | undefined;
  band: string | null | undefined;
  hasPenalty?: boolean;
}) => {
  if (score == null)
    return <span className="text-zinc-600 text-[12px]">—</span>;

  // Sentiment Icon Logic (For Top Row)
  let SentimentIcon = Minus;
  let sentimentColor = "text-zinc-600";

  if (sentiment === "optimistic") {
    SentimentIcon = ArrowUp;
    sentimentColor = "text-[#1ee3cf]";
  } else if (sentiment === "pessimistic") {
    SentimentIcon = ArrowDown;
    sentimentColor = "text-[#ff6b6b]";
  } else if (sentiment === "neutral") {
    SentimentIcon = Minus;
    sentimentColor = "text-[#a1a1aa]";
  }

  // Score Colors (FGOS)
  let scoreColor = "text-[#ff6b6b]"; // < 65
  
  if ((score ?? 0) >= 80) {
    scoreColor = "text-[#1ee3cf]";
  } else if ((score ?? 0) >= 65) {
    scoreColor = "text-[#f5a623]";
  }

  // Moat / Competitive Advantage Logic (For Bottom Row)
  // band corresponds to "strong", "defendable", "weak"
  let moatLabel = band || "—";
  let moatColor = "text-zinc-500";
  let MoatIcon = Minus;

  const bandLower = (band || "").toLowerCase();

  if (bandLower.includes("strong") || bandLower.includes("wide") || bandLower.includes("fuerte")) {
     // Strong / Wide -> Triangle Up (Filled representation)
     MoatIcon = ArrowUp; // Using ArrowUp as placeholder for Triangle Up, or customize with SVG
     moatColor = "text-[#1ee3cf]"; // Cyan
  } else if (bandLower.includes("weak") || bandLower.includes("none") || bandLower.includes("débil")) {
     // Weak / None -> Triangle Down
     MoatIcon = ArrowDown;
     moatColor = "text-[#ff6b6b]"; // Red
  } else if (bandLower.includes("defendable") || bandLower.includes("narrow") || bandLower.includes("moderada")) {
     // Defendable / Narrow -> Square / Neutral
     MoatIcon = Minus; // Or Square if available
     moatColor = "text-[#f5a623]"; // Amber
  }

  let moatSymbol = "■";
  if (bandLower.includes("strong") || bandLower.includes("wide") || bandLower.includes("fuerte")) {
      moatSymbol = "▲";
  } else if (bandLower.includes("weak") || bandLower.includes("none") || bandLower.includes("débil")) {
      moatSymbol = "▼";
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-0.5">
      {/* Top Row: Alert + Score + Sentiment */}
      <div className="flex items-center gap-1.5 leading-none">
        {hasPenalty && (
          <AlertTriangle className="w-3 h-3 text-amber-500" strokeWidth={2} />
        )}
        <span className={`font-mono font-bold text-[13px] ${scoreColor}`}>
          {score?.toFixed(0) ?? "—"}
        </span>
        <SentimentIcon
          className={`w-3 h-3 ${sentimentColor}`}
          strokeWidth={2.5}
        />
      </div>

      {/* Bottom Row: Competitive Advantage (Moat) */}
      <div className={`flex items-center gap-1 text-[10px] uppercase font-medium tracking-wide ${moatColor} leading-none`}>
        <span className="text-[9px]">{moatSymbol}</span>
        <span>{moatLabel}</span>
      </div>
    </div>
  );
};
