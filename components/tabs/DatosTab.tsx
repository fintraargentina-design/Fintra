'use client';

import { useRef, useMemo } from "react";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosCard from "@/components/cards/DividendosCard";
import { useSyncedHorizontalScroll } from "@/lib/ui/useSyncedHorizontalScroll";

type PeriodSel = "ttm" | "FY" | "Q1" | "Q2" | "Q3" | "Q4" | "annual" | "quarter";

interface DatosTabProps {
  stockAnalysis: any;
  stockPerformance?: any;
  stockBasicData?: any;
  symbol: string;
  period?: PeriodSel;         // Kept for compatibility but unused
  ratios?: any;               // Kept for compatibility but unused
  metrics?: any;              // Kept for compatibility but unused
}

export default function DatosTab({
  stockAnalysis,
  stockPerformance,
  stockBasicData,
  symbol,
}: DatosTabProps) {
  // Refs for synchronized horizontal scrolling
  const fundamentalRef = useRef<HTMLDivElement>(null);
  const valoracionRef = useRef<HTMLDivElement>(null);
  const desempenoRef = useRef<HTMLDivElement>(null);

  // Group refs in a stable array
  const scrollRefs = useMemo(() => [
    fundamentalRef,
    valoracionRef,
    desempenoRef
  ], []);

  // Activate the hook
  useSyncedHorizontalScroll(scrollRefs);

  return (
    <div className="w-full h-full flex flex-col gap-1 p-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
        <div className="bg-tarjetas border border-zinc-800">
          <FundamentalCard 
            symbol={symbol} 
            scrollRef={fundamentalRef}
          />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
          <ValoracionCard 
            symbol={symbol} 
            scrollRef={valoracionRef}
          />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
           <DesempenoCard 
             symbol={symbol} 
             scrollRef={desempenoRef}
           />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
           <DividendosCard symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
