"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMemo } from "react";

import PeersAnalysisPanel from "@/components/dashboard/PeersAnalysisPanel";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosTableCard from "@/components/cards/DividendosTableCard";
import ChartsTabHistoricos from "@/components/tabs/ChartsTabHistoricos";
import FGOSRadarChart from "@/components/charts/FGOSRadarChart";


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
      <DialogContent className="max-w-[98vw] w-[98vw] max-h-[98vh] h-auto bg-[#0A0A0A] border border-zinc-800 rounded-none p-0">
        <DialogTitle className="sr-only">
          Detalle expandido {ticker}
        </DialogTitle>
        <div className="w-full h-full flex flex-col">
          {/* Main Scrollable Content */}
          <div className="flex-1 overflow-y-auto scrollbar-on-hover grid grid-cols-1 xl:grid-cols-2 gap-1 p-1">
              
              {/* 2. Remaining Grid of Medium Cards - Peers top, Charts/FGOS bottom split */}
              <div className="grid grid-cols-1 grid-rows-2 gap-1 h-full">
                 
                {/* Peers */}
                 <div className="bg-tarjetas border border-zinc-800 h-full flex flex-col">
                    <PeersAnalysisPanel
                        symbol={ticker}
                        onPeerSelect={setSelectedCompetitor}
                        selectedPeer={selectedCompetitor}
                    />
                 </div>

                 {/* Charts & FGOS Side-by-Side */}
                <div className="grid grid-cols-[60%_40%] gap-1 h-full">
                    {/* Charts */}
                     <div className="bg-tarjetas border border-zinc-800 h-full">
                       <ChartsTabHistoricos
                         symbol={ticker}
                         companyName={stockBasicData?.companyName}
                         comparedSymbols={comparedSymbolsList}
                         isActive={isActive}
                       />
                     </div>

                     {/* FGOS */}
                     <div className="bg-tarjetas border border-zinc-800 h-full">
                       <FGOSRadarChart
                         symbol={ticker}
                         data={stockAnalysis?.fgos_breakdown}
                         comparedSymbol={selectedCompetitor}
                         isActive={isActive}
                       />
                     </div>
                 </div>
              </div>

              {/* 1. Top Section: Resumen + Core Cards */}
              
              {/* Right: Vertical Stack of Core Cards */}
              <div className="flex flex-col border border-zinc-800 bg-tarjetas">
                 <div className="border-b border-zinc-800 last:border-0">
                  <FundamentalCard
                    symbol={ticker}
                    peerTicker={selectedCompetitor}
                    defaultExpanded={true}
                    hideExpandButton={true}
                  />
                </div>
                <div className="border-b border-zinc-800 last:border-0">
                  <ValoracionCard
                    symbol={ticker}
                    peerTicker={selectedCompetitor}
                    defaultExpanded={true}
                    hideExpandButton={true}
                  />
                </div>
                <div className="border-b border-zinc-800 last:border-0">
                  <DesempenoCard
                    symbol={ticker}
                    peerTicker={selectedCompetitor}
                    defaultExpanded={true}
                  />
                </div>
                <div className="border-b border-zinc-800 last:border-0">
                  <DividendosTableCard
                    symbol={ticker}
                    peerTicker={selectedCompetitor}
                    defaultExpanded={true}
                  />
                </div>
              </div>



          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
