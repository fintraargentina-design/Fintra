"use client";

import ResumenCard from "@/components/cards/ResumenCard";
import NoticiasTicker from "@/components/tabs/NoticiasTicker";

interface CentralPanelProps {
  selectedTicker: string;
  onStockSelect?: (symbol: string) => void;
}

export default function CentralPanel({ selectedTicker, onStockSelect }: CentralPanelProps) {
  return (
    <div className="w-full h-full flex flex-col gap-1 min-h-0 overflow-hidden">
      {/* Resumen Card Section */}
      <div className="w-full shrink-0">
         <ResumenCard 
           symbol={selectedTicker} 
           onStockSearch={onStockSelect}
         />
      </div>

      {/* Noticias Ticker Section */}
      <div className="w-full flex-1 min-h-0 overflow-hidden border border-zinc-800 bg-[#0A0A0A] relative">
         <NoticiasTicker symbol={selectedTicker} />
      </div>
    </div>
  );
}
