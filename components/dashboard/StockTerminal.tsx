'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getAvailableSectors, getIndustriesForSector } from "@/lib/repository/fintra-db";
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import LeftPanel from '@/components/dashboard/LeftPanel';
import CentralPanel from '@/components/dashboard/CentralPanel';
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

  // Filter State (Lifted from SectorAnalysisPanel)
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedSector, setSelectedSector] = useState("Technology");
  
  const [industries, setIndustries] = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState("Todas");

  const [selectedExchange, setSelectedExchange] = useState("NYSE");

  // Load Sectors on Mount
  useEffect(() => {
    let mounted = true;
    const fetchSectors = async () => {
      const USE_MOCK = true;
      if (USE_MOCK) {
         if (mounted) {
            setSectors(["Technology", "Financial Services", "Consumer Cyclical", "Healthcare", "Energy"]);
         }
      } else {
         try {
            const available = await getAvailableSectors();
            if (mounted && available.length > 0) {
               setSectors(available);
               const defaultSector = available.find(s => s === "Technology") || available[0];
               setSelectedSector(defaultSector);
            }
         } catch (e) { console.error(e); }
      }
    };
    fetchSectors();
    return () => { mounted = false; };
  }, []);

  // Load Industries when Sector changes
  useEffect(() => {
      let mounted = true;
      const loadIndustries = async () => {
          if (!selectedSector) return;
          
          // Reset industry to "Todas" when sector changes
          // Only if the current selected industry is not valid for the new sector? 
          // Simpler to just reset to "Todas" or keep if it exists (but likely won't).
          setSelectedIndustry("Todas");
          
          try {
             const inds = await getIndustriesForSector(selectedSector);
             if (mounted) {
                 setIndustries(inds);
             }
          } catch (e) { console.error(e); }
      };
      loadIndustries();
      return () => { mounted = false; };
  }, [selectedSector]);


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
      <Header 
        sectors={sectors}
        selectedSector={selectedSector}
        onSectorChange={setSelectedSector}
        industries={industries}
        selectedIndustry={selectedIndustry}
        onIndustryChange={setSelectedIndustry}
        selectedExchange={selectedExchange}
        onExchangeChange={setSelectedExchange}
        onStockSelect={handleTopStockClick}
      />

      {/* Contenedor principal responsivo - Ancho completo */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        {selectedStock && (
          <div className="space-y-1 md:space-y-1 h-full">

            {/* Layout principal responsivo: 3 Columnas (Left 25% - Center 35% - Right 40%) */}
            <div className="bg-[#0A0A0A] grid grid-cols-1 xl:grid-cols-[30fr_30fr_40fr] md:gap-2 items-start h-full pt-2 pl-2 pr-2">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-auto flex flex-col gap-1 min-h-0 h-full border border-zinc-800 overflow-hidden">
                <LeftPanel 
                  onStockSelect={handleTopStockClick} 
                  selectedTicker={selectedSymbol} 
                  sectors={sectors}
                  selectedSector={selectedSector}
                  industries={industries}
                  selectedIndustry={selectedIndustry}
                  selectedExchange={selectedExchange}
                />                
              </div>

              {/* Panel Central */}
              <div className="w-full xl:w-auto h-full flex flex-col overflow-hidden border border-zinc-800 pb-1 gap-1">
                  <CentralPanel selectedTicker={selectedSymbol} onStockSelect={handleTopStockClick} />
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-auto h-full flex flex-col overflow-hidden border border-zinc-800 pb-1 gap-1">
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
