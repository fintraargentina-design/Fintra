"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";

import PeersAnalysisPanel from "@/components/dashboard/PeersAnalysisPanel";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosTableCard from "@/components/cards/DividendosTableCard";
import ChartsTabHistoricos from "@/components/tabs/ChartsTabHistoricos";
import FGOSRadarChart from "@/components/charts/FGOSRadarChart";
import TickerExpandidoView from "@/components/dashboard/TickerExpandidoView";


import type { StockEcosystem } from "@/lib/fmp/types";
import type { StockData, StockAnalysis, StockPerformance } from "@/lib/stockQueries";

interface TickerExpandidoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticker: string;
  selectedCompetitor: string | null;
  setSelectedCompetitor: (ticker: string | null) => void;
  stockBasicData: StockData | null;
  stockAnalysis: StockAnalysis | null;
  stockPerformance: StockPerformance | null;
  stockEcosystem: StockEcosystem | null;
  stockRatios: any;
  stockMetrics: any;
  isLoading: boolean;
  isActive: boolean;
  onStockSearch: (symbol: string) => Promise<void> | void;
}

export default function TickerExpandidoModal({
  open,
  onOpenChange,
  ticker,
  selectedCompetitor,
  setSelectedCompetitor,
  stockBasicData,
  stockAnalysis,
  stockPerformance,
  stockEcosystem,
  stockRatios,
  stockMetrics,
  isLoading,
  isActive,
  onStockSearch,
}: TickerExpandidoModalProps) {
  const comparedSymbolsList = useMemo(
    () => (selectedCompetitor ? [selectedCompetitor] : []),
    [selectedCompetitor]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        overlayClassName="backdrop-blur-sm"
        className="max-w-[98vw] w-[98vw] max-h-[98vh] h-auto bg-[#0A0A0A] border border-zinc-800 rounded-none p-0"
      >
        <DialogTitle className="sr-only">
          Detalle expandido {ticker}
        </DialogTitle>
        <TickerExpandidoView
          ticker={ticker}
          selectedCompetitor={selectedCompetitor}
          setSelectedCompetitor={setSelectedCompetitor}
          stockBasicData={stockBasicData}
          stockAnalysis={stockAnalysis}
          stockPerformance={stockPerformance}
          stockEcosystem={stockEcosystem}
          stockRatios={stockRatios}
          stockMetrics={stockMetrics}
          isLoading={isLoading}
          isActive={isActive}
          onStockSearch={onStockSearch}
          showOpenNewWindowButton={true}
        />
      </DialogContent>
    </Dialog>
  );
}
