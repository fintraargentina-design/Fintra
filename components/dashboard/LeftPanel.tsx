'use client';

import React, { memo, useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FintraLogo from '@/public/fav.webp';
import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';
import TickerSearchPanel from '@/components/dashboard/TickerSearchPanel';
import GlobalSearchInput from '@/components/dashboard/GlobalSearchInput';
import MercadosTab from '@/components/tabs/MercadosTab';

interface LeftPanelProps {
  onStockSelect: (symbol: string) => void;
  selectedTicker?: string;
}

const STORAGE_KEY = 'fintra_left_panel_tab';

const LeftPanel = memo(({ onStockSelect, selectedTicker }: LeftPanelProps) => {
  const [activeTab, setActiveTab] = useState("mercados");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setActiveTab(saved);
      }
      setIsInitialized(true);
    }
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, value);
    }
  };

  // Prevent hydration mismatch by rendering default or nothing until initialized?
  // Actually, for a smoother UX, rendering default "mercados" is fine, 
  // it will switch immediately after mount if needed.
  
  return (
    <div className="w-full h-[60%] flex flex-col min-h-0">
      <Tabs 
        value={activeTab} 
        onValueChange={handleTabChange}
        className="w-full h-full flex flex-col bg-[#0A0A0A] pt-1"
      >
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
          <SectorAnalysisPanel onStockSelect={onStockSelect} selectedTicker={selectedTicker} />
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
