'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import TwitsTab from '@/components/tabs/TwitsTab';
import Footer from '@/components/layout/Footer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import FintraLogo from '@/public/6.png';
import SectorAnalysisPanel from '@/components/dashboard/SectorAnalysisPanel';
import TickerSearchPanel from '@/components/dashboard/TickerSearchPanel';
import GlobalSearchInput from '@/components/dashboard/GlobalSearchInput';
import MercadosTab from '@/components/tabs/MercadosTab';

import TabManager from '@/components/dashboard/TabManager';

export type TabKey = 'resumen' | 'competidores' | 'datos' | 'chart' | 'informe' | 'estimacion' | 'noticias' | 'twits' | 'ecosistema' | 'indices' | 'horarios' | 'empresa';

export default function StockTerminal() {
  const pathname = usePathname();
  const [selectedStock, setSelectedStock] = useState<string | { symbol: string }>(() => {
    if (pathname && pathname !== '/') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[0].toUpperCase();
    }
    return 'AAPL';
  });
  const [activeTab, setActiveTab] = useState<TabKey>('empresa');


  // símbolo actual (string) sin importar si selectedStock es string u objeto
  const selectedSymbol = useMemo(() => {
    if (typeof selectedStock === 'string') return selectedStock.toUpperCase?.() || '';
    return (selectedStock?.symbol || '').toUpperCase();
  }, [selectedStock]);



  const handleTopStockClick = (symbol: string) => {
    setSelectedStock(symbol);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-black overflow-hidden">


      {/* Contenedor principal responsivo - Ancho completo */}
      <div className="flex-1 w-full px-1 min-h-0 overflow-hidden relative">
        {selectedStock && (
          <div className="space-y-1 md:space-y-1 h-full">

            {/* Layout principal responsivo */}
            <div className="grid grid-cols-1 xl:grid-cols-[50fr_50fr] gap-0 md:gap-1 items-start h-full">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-auto flex flex-col gap-1 min-h-0 h-full overflow-hidden">
                <div className="w-full h-[60%] flex flex-col min-h-0">
                  
                  <Tabs defaultValue="mercados" className="w-full h-full flex flex-col bg-[#0A0A0A] pt-1">
                    
                    <div className="w-full border-b border-zinc-800 bg-transparent z-10 shrink-0">
                      
                      <div className="w-full flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap">
                        <div className="flex items-center px-0 shrink-0">
                          <img src={FintraLogo.src} alt="Fintra Logo" className=" h-6 ml-2" />
                          {/* <h1 className="text-l font-medium text-[#FFA028] truncate">
                            Fintra 
                          </h1> */}
                          
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
                             <GlobalSearchInput onSelect={handleTopStockClick} />
                          </div>
                        </TabsList>
                      </div>
                    </div>
                    
                    <TabsContent value="sector_score" className="flex-1 min-h-0 mt-0 bg-[#0A0A0A]">
                      <SectorAnalysisPanel onStockSelect={handleTopStockClick} />
                    </TabsContent>
                    
                    <TabsContent value="ticker_search" className="flex-1 min-h-0 mt-0 bg-[#0A0A0A]">
                      <TickerSearchPanel onStockSelect={handleTopStockClick} />
                    </TabsContent>
                    
                    <TabsContent value="mercados" className="flex-1 min-h-0 pb-1 mt-0 bg-[#0A0A0A]">
                      <MercadosTab />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="w-full h-[40%] grid grid-cols-2 gap-1 min-h-0 pb-1">
                  <div className="h-full w-full overflow-hidden border border-zinc-800 bg-[#0A0A0A] relative">
                      <TwitsTab />
                   </div>
                   <div className="h-full w-full overflow-hidden border border-zinc-800 bg-[#0A0A0A] relative">
                      <NoticiasTab symbol={selectedSymbol} />
                   </div>
                </div>
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-auto h-full flex flex-col overflow-hidden bg-[#0A0A0A] pb-1 pt-1 gap-1">
                 <div className="w-full h-full overflow-hidden">
                    <TabManager 
                       requestedTicker={selectedSymbol} 
                       onActiveTickerChange={handleTopStockClick} 
                    />
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
