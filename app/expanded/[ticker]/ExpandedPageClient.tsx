
"use client";

import { useState } from "react";
import TickerExpandidoView from "@/components/dashboard/TickerExpandidoView";
import { TickerFullView } from "@/lib/services/ticker-view.service";

interface ExpandedPageClientProps {
  ticker: string;
  initialData: TickerFullView;
}

export default function ExpandedPageClient({ ticker, initialData }: ExpandedPageClientProps) {
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  
  // We use initialData to populate the view.
  // Note: TickerExpandidoView expects loading/active states. 
  // Since we have initialData, isLoading is false.
  
  const handleStockSearch = async (symbol: string) => {
    // In standalone mode, searching might redirect to that ticker's page
    window.location.href = `/expanded/${symbol}`;
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0A0A0A]">
      <TickerExpandidoView
        ticker={ticker}
        selectedCompetitor={selectedCompetitor}
        setSelectedCompetitor={setSelectedCompetitor}
        
        stockBasicData={initialData.stockBasicData}
        stockAnalysis={initialData.stockAnalysis}
        stockPerformance={initialData.stockPerformance}
        stockEcosystem={initialData.stockEcosystem}
        stockRatios={initialData.stockRatios}
        stockMetrics={initialData.stockMetrics}
        
        isLoading={false}
        isActive={true}
        onStockSearch={handleStockSearch}
        showOpenNewWindowButton={false} // Already in standalone
      />
    </div>
  );
}
