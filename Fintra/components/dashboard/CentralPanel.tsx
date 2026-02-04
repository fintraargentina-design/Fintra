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
    <div className="w-full h-full flex flex-col min-h-0 bg-[#0e0e0e] overflow-hidden">
      
      {/* Scrollable Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        
        {/* Resumen Section */}
        <div className="w-full shrink-0 border-b border-[#222] bg-[#0e0e0e]">
           <ResumenCard 
             symbol={selectedTicker} 
             onStockSearch={onStockSelect}
           />
        </div>

        {/* Historical Charts Section */}
        <div className="w-full h-[350px] shrink-0 bg-[#0e0e0e] border-b border-[#222] relative">
           <ChartsTabHistoricos symbol={selectedTicker} isActive={true} />
        </div>

        {/* News Section */}
        <div className="w-full flex-1 min-h-[250px] bg-[#0e0e0e]">
           <NoticiasTicker symbol={selectedTicker} />
        </div>
      </div>
    </div>
  );
}
