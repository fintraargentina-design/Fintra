import React from 'react';
import OverviewCard from '@/components/cards/OverviewCard';
import PeersAnalysisPanel from '@/components/dashboard/PeersAnalysisPanel';
import ChartsTabHistoricos from '@/components/tabs/ChartsTabHistoricos';
import FGOSRadarChart from '@/components/charts/FGOSRadarChart';

interface EmpresaEnVistaCardProps {
  selectedStock: any;
  stockConclusion: any;
  buscarDatosAccion: (symbol: string) => void;
  setIsSearchOpen: (open: boolean) => void;
  isLoading: boolean;
  stockAnalysis: any;
  selectedSymbol: string;
  setSelectedCompetitor: (symbol: string | null) => void;
  selectedCompetitor: string | null;
  stockBasicData: any;
}

export default function EmpresaEnVistaCard({
  selectedStock,
  stockConclusion,
  buscarDatosAccion,
  setIsSearchOpen,
  isLoading,
  stockAnalysis,
  selectedSymbol,
  setSelectedCompetitor,
  selectedCompetitor,
  stockBasicData
}: EmpresaEnVistaCardProps) {
  return (
    <div className="w-full h-full flex flex-col gap-1 overflow-hidden">
      {/* 2. Overview - Auto Height (Fixed) */}
      <div className="shrink-0 w-full border border-zinc-800">
        <OverviewCard
            selectedStock={selectedStock}
            stockConclusion={stockConclusion}
            onStockSearch={buscarDatosAccion}
            onOpenSearchModal={() => setIsSearchOpen(true)}
            isParentLoading={isLoading}
            analysisData={stockAnalysis}
          />
      </div>

      {/* 3. Peers - Flexible (Takes remaining space) */}
      <div className="flex-1 min-h-0 relative border border-zinc-800">
        <PeersAnalysisPanel 
          symbol={selectedSymbol} 
          onPeerSelect={setSelectedCompetitor}
          selectedPeer={selectedCompetitor}
        />
      </div>

      {/* 4. Charts - 30% Fixed */}
      <div className="h-[30%] shrink-0 min-h-0 pb-1">
        <div className="flex flex-col lg:flex-row w-full h-full gap-1">
            {/* Chart 3/5 */}
            <div className="w-full lg:w-3/5 h-full">
                <ChartsTabHistoricos
                  symbol={selectedSymbol}
                  companyName={stockBasicData?.companyName}
                  comparedSymbols={selectedCompetitor ? [selectedCompetitor] : []}
                />
            </div>
            {/* Radar 2/5 */}
            <div className="w-full lg:w-2/5 h-full border border-zinc-800">
                  <FGOSRadarChart 
                    symbol={selectedSymbol} 
                    data={stockAnalysis?.fgos_breakdown} 
                    comparedSymbol={selectedCompetitor}
                  />
            </div>
        </div>                
      </div>
    </div>
  );
}
