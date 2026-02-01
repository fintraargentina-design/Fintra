"use client";

import ResumenCard from "@/components/cards/ResumenCard";
import NoticiasTicker from "@/components/tabs/NoticiasTicker";
import ChartsTabHistoricos from "@/components/tabs/ChartsTabHistoricos";

interface CentralPanelProps {
  selectedTicker: string;
  onStockSelect?: (symbol: string) => void;
}

export default function CentralPanel({ selectedTicker, onStockSelect }: CentralPanelProps) {
  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-[#09090b] border border-zinc-800 rounded-md overflow-hidden">
      {/* Header Section - Matches Image "Overview" */}
      <div className="h-7 shrink-0 bg-[#172554] flex items-center justify-center border-b border-zinc-800">
        <span className="text-[11px] font-semibold text-blue-100 tracking-wide uppercase">Overview</span>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        
        {/* Resumen Section */}
        <div className="w-full shrink-0 border-b border-zinc-800 bg-[#09090b]">
           <ResumenCard 
             symbol={selectedTicker} 
             onStockSearch={onStockSelect}
           />
        </div>

        {/* Historical Charts Section */}
        <div className="w-full h-[450px] shrink-0 bg-[#09090b] border-b border-zinc-800 relative">
           <ChartsTabHistoricos symbol={selectedTicker} isActive={true} />
        </div>

        {/* News Section */}
        <div className="w-full flex-1 min-h-[400px] bg-[#09090b]">
           <NoticiasTicker symbol={selectedTicker} />
        </div>
      </div>
    </div>
  );
}
