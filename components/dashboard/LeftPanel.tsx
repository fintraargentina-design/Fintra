'use client';

import React, { memo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FintraLogo from '@/public/6.png';
import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';
import TickerSearchPanel from '@/components/dashboard/TickerSearchPanel';
import GlobalSearchInput from '@/components/dashboard/GlobalSearchInput';
import MercadosTab from '@/components/tabs/MercadosTab';

interface LeftPanelProps {
  onStockSelect: (symbol: string) => void;
}

const LeftPanel = memo(({ onStockSelect }: LeftPanelProps) => {
  return (
    <div className="w-full h-[60%] flex flex-col min-h-0">
      <Tabs defaultValue="mercados" className="w-full h-full flex flex-col bg-[#0A0A0A] pt-1">
        <div className="w-full border-b border-zinc-800 bg-transparent z-10 shrink-0">
          <div className="w-full flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap">
            <div className="flex items-center px-0 shrink-0">
              <img src={FintraLogo.src} alt="Fintra Logo" className=" h-6 ml-2" />
            </div>
           
            <TabsList className="bg-transparent h-auto p-0 flex gap-0.5 border-b-2 border-black justify-start flex-1">
              <TabsTrigger 
                value="mercados"
                className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#002D72] data-[state=active]:text-white text-xs px-4 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors w-auto"
              >
                Mercados
              </TabsTrigger>
              <TabsTrigger 
                value="sector_score"
                className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#002D72] data-[state=active]:text-white text-xs px-4 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors w-auto"
              >
                Clasificación Fintra - IFS
              </TabsTrigger>
              <TabsTrigger 
                value="ticker_search"
                className="bg-zinc-900 rounded-none border-b-0 data-[state=active]:bg-[#002D72] data-[state=active]:text-white text-xs px-4 py-1 text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors w-auto"
              >
                Screener
              </TabsTrigger>
              
              <div className="shrink-0 ml-1">
                 <GlobalSearchInput onSelect={onStockSelect} />
              </div>
            </TabsList>
          </div>
        </div>
        
        <TabsContent value="sector_score" className="flex-1 min-h-0 mt-0 bg-[#0A0A0A]">
          <SectorAnalysisPanel onStockSelect={onStockSelect} />
        </TabsContent>
        
        <TabsContent value="ticker_search" className="flex-1 min-h-0 mt-0 bg-[#0A0A0A]">
          <TickerSearchPanel onStockSelect={onStockSelect} />
        </TabsContent>
        
        <TabsContent value="mercados" className="flex-1 min-h-0 pb-1 mt-0 bg-[#0A0A0A]">
          <MercadosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
});

LeftPanel.displayName = 'LeftPanel';

export default LeftPanel;
