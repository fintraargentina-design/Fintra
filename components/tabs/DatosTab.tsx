'use client';

import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosCard from "@/components/cards/DividendosCard";

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

  return (
    <div className="w-full h-full flex flex-col gap-1 p-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
        <div className="bg-tarjetas border border-zinc-800">
          <FundamentalCard 
            symbol={symbol} 
          />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
          <ValoracionCard 
            symbol={symbol} 
          />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
           <DesempenoCard symbol={symbol} />
        </div>
        <div className="bg-tarjetas border border-zinc-800">
           <DividendosCard symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
