'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import NoticiasTab from '@/components/tabs/NoticiasTab';
import NoticiasTicker from '@/components/tabs/NoticiasTicker';
import Footer from '@/components/layout/Footer';
import LeftPanel from '@/components/dashboard/LeftPanel';
import TabManager from '@/components/dashboard/TabManager';

export type TabKey = 'resumen' | 'competidores' | 'datos' | 'chart' | 'informe' | 'estimacion' | 'escenarios' | 'conclusion' | 'noticias' | 'twits' | 'ecosistema' | 'indices' | 'horarios' | 'empresa' | 'snapshot';

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



  const handleTopStockClick = useCallback((symbol: string) => {
    setSelectedStock(symbol);
  }, []);

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
                <LeftPanel onStockSelect={handleTopStockClick} selectedTicker={selectedSymbol} />

                <div className="w-full h-[40%] grid grid-cols-2 gap-1 min-h-0 pb-1">
                  <div className="h-full w-full overflow-hidden border border-zinc-800 bg-[#0A0A0A] relative">
                      <NoticiasTab symbol={selectedSymbol} />
                   </div>
                  <div className="h-full w-full overflow-hidden border border-zinc-800 bg-[#0A0A0A] relative">
                      <NoticiasTicker symbol={selectedSymbol} />
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
