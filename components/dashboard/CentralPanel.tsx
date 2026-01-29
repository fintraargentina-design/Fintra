"use client";

import ResumenCard from "@/components/cards/ResumenCard";
import NoticiasTicker from "@/components/tabs/NoticiasTicker";
import BalanceBarChart from "@/components/charts/BalanceBarChart";
import ChartsTabHistoricos from "@/components/tabs/ChartsTabHistoricos";

interface CentralPanelProps {
  selectedTicker: string;
  onStockSelect?: (symbol: string) => void;
}

export default function CentralPanel({ selectedTicker, onStockSelect }: CentralPanelProps) {
  return (
    <div className="w-full h-full flex flex-col min-h-0 overflow-y-auto">
      {/* Resumen Card Section */}
      <div className="w-full shrink-0">
         <ResumenCard 
           symbol={selectedTicker} 
           onStockSearch={onStockSelect}
         />
      </div>

      {/* Balance Bar Chart Section */}
      <div className="w-full h-[150px] shrink-0 bg-[#0A0A0A]">
         <BalanceBarChart symbol={selectedTicker} />
      </div>

      {/* Historical Charts Tab Section */}
      <div className="w-full h-[250px] shrink-0 bg-[#0A0A0A]">
         <ChartsTabHistoricos symbol={selectedTicker} isActive={true} />
      </div>

      {/* Noticias Ticker Section */}
      <div className="w-full flex-1 min-h-[300px] overflow-hidden bg-[#0A0A0A]">
         <NoticiasTicker symbol={selectedTicker} />
      </div>
    </div>
  );
}
