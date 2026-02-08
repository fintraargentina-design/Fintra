"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

import PeersAnalysisPanel from "@/components/dashboard/PeersAnalysisPanel";
import FundamentalCard from "@/components/cards/FundamentalCard";
import ValoracionCard from "@/components/cards/ValoracionCard";
import DesempenoCard from "@/components/cards/DesempenoCard";
import DividendosTableCard from "@/components/cards/DividendosTableCard";
import ChartsTabHistoricos from "@/components/tabs/ChartsTabHistoricos";
import FGOSRadarChart from "@/components/charts/FGOSRadarChart";

import type { StockEcosystem } from "@/lib/fmp/types";
import type { StockData, StockAnalysis, StockPerformance } from "@/lib/stockQueries";
import { 
  getFinancialHistory, 
  getValuationHistory, 
  getPerformanceHistory, 
  getDividendHistory,
  FinancialHistory,
  ValuationHistory,
  PerformanceHistory,
  DividendHistory
} from "@/lib/services/ticker-view.service";

interface TickerExpandidoViewProps {
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
  showOpenNewWindowButton?: boolean;
}

export default function TickerExpandidoView({
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
  showOpenNewWindowButton = true,
}: TickerExpandidoViewProps) {
  const [financialData, setFinancialData] = useState<FinancialHistory[]>([]);
  const [valuationData, setValuationData] = useState<ValuationHistory[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceHistory[]>([]);
  const [dividendData, setDividendData] = useState<DividendHistory[]>([]);

  const [peerFinancialData, setPeerFinancialData] = useState<FinancialHistory[]>([]);
  const [peerValuationData, setPeerValuationData] = useState<ValuationHistory[]>([]);
  const [peerPerformanceData, setPeerPerformanceData] = useState<PerformanceHistory[]>([]);
  const [peerDividendData, setPeerDividendData] = useState<DividendHistory[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const [fin, val, perf, div] = await Promise.all([
            getFinancialHistory(ticker),
            getValuationHistory(ticker),
            getPerformanceHistory(ticker),
            getDividendHistory(ticker)
        ]);
        
        if (mounted) {
            setFinancialData(fin);
            setValuationData(val);
            setPerformanceData(perf);
            setDividendData(div);
        }
      } catch (error) {
        console.error("Error fetching service data:", error);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [ticker]);

  useEffect(() => {
    if (!selectedCompetitor) {
        setPeerFinancialData([]);
        setPeerValuationData([]);
        setPeerPerformanceData([]);
        setPeerDividendData([]);
        return;
    }
    
    let mounted = true;
    const fetchPeerData = async () => {
      try {
        const [fin, val, perf, div] = await Promise.all([
            getFinancialHistory(selectedCompetitor),
            getValuationHistory(selectedCompetitor),
            getPerformanceHistory(selectedCompetitor),
            getDividendHistory(selectedCompetitor)
        ]);
        
        if (mounted) {
            setPeerFinancialData(fin);
            setPeerValuationData(val);
            setPeerPerformanceData(perf);
            setPeerDividendData(div);
        }
      } catch (error) {
        console.error("Error fetching peer service data:", error);
      }
    };

    fetchPeerData();
    return () => { mounted = false; };
  }, [selectedCompetitor]);

  const comparedSymbolsList = useMemo(
    () => (selectedCompetitor ? [selectedCompetitor] : []),
    [selectedCompetitor]
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center justify-between px-16 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
         <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 flex items-center justify-center overflow-hidden rounded-md bg-zinc-900 border border-zinc-800">
                <img 
                  src={`https://financialmodelingprep.com/image-stock/${ticker.toUpperCase()}.png`}
                  alt={ticker}
                  className="w-full h-full object-contain p-1"
                  onError={(e: any) => {
                     e.currentTarget.style.display = 'none';
                     const span = e.currentTarget.parentElement?.querySelector('.fallback-text') as HTMLElement;
                     if (span) span.style.display = 'block';
                  }}
                />
                <span className="fallback-text text-zinc-500 font-bold text-[10px]" style={{ display: 'none' }}>
                  {ticker.slice(0, 2)}
                </span>
            </div>
            <div className="flex flex-col">
               <span className="text-zinc-200 text-sm font-bold leading-tight">{ticker}</span>
               <span className="text-zinc-500 text-xs truncate max-w-[300px] leading-tight">{stockBasicData?.companyName}</span>
            </div>
         </div>
         
         {showOpenNewWindowButton && (
           <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => window.open(`/expanded/${ticker}`, '_blank')}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              title="Abrir en nueva ventana"
           >
              <ExternalLink className="w-4 h-4" />
           </Button>
         )}
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin grid grid-cols-1 xl:grid-cols-2 gap-1 p-1">
          
          {/* 2. Remaining Grid of Medium Cards - Peers top, Charts/FGOS bottom split */}
          <div className="grid grid-cols-1 grid-rows-2 gap-1 h-full">
             
            {/* Peers */}
             <div className="bg-tarjetas border border-zinc-800 rounded h-full flex flex-col">
                <PeersAnalysisPanel
                    symbol={ticker}
                    onPeerSelect={setSelectedCompetitor}
                    selectedPeer={selectedCompetitor}
                />
             </div>

             {/* Charts & FGOS Side-by-Side */}
            <div className="grid grid-cols-[60%_40%] gap-1 h-full">
                {/* Charts */}
                 <div className="bg-tarjetas border border-zinc-800 rounded h-full">
                   <ChartsTabHistoricos
                     symbol={ticker}
                     companyName={stockBasicData?.companyName}
                     comparedSymbols={comparedSymbolsList}
                     isActive={isActive}
                   />
                 </div>

                 {/* FGOS */}
                 <div className="bg-tarjetas border border-zinc-800 rounded h-full">
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
          <div className="flex flex-col border border-zinc-800 rounded bg-tarjetas">
             <div className="border-b border-zinc-800 last:border-0">
              <FundamentalCard
                symbol={ticker}
                peerTicker={selectedCompetitor}
                defaultExpanded={true}
                hideExpandButton={true}
                data={financialData}
                peerData={peerFinancialData}
              />
            </div>
            <div className="border-b border-zinc-800 last:border-0">
              <ValoracionCard
                symbol={ticker}
                peerTicker={selectedCompetitor}
                defaultExpanded={true}
                hideExpandButton={true}
                data={valuationData}
                peerData={peerValuationData}
              />
            </div>
            <div className="border-b border-zinc-800 last:border-0">
              <DesempenoCard
                symbol={ticker}
                peerTicker={selectedCompetitor}
                defaultExpanded={true}
                data={performanceData}
                peerData={peerPerformanceData}
              />
            </div>
            <div className="border-b border-zinc-800 last:border-0">
              <DividendosTableCard
                symbol={ticker}
                peerTicker={selectedCompetitor}
                defaultExpanded={true}
                data={dividendData}
                peerData={peerDividendData}
              />
            </div>
          </div>
      </div>
    </div>
  );
}
