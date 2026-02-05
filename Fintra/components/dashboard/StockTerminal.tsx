"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useFilterOptions } from "@/hooks/useFilterOptions";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import LeftPanel from "@/components/dashboard/LeftPanel";
import CentralPanel from "@/components/dashboard/CentralPanel";
import TabManager from "@/components/dashboard/TabManager";

export type TabKey =
  | "resumen"
  | "competidores"
  | "datos"
  | "chart"
  | "informe"
  | "estimacion"
  | "escenarios"
  | "conclusion"
  | "noticias"
  | "twits"
  | "ecosistema"
  | "indices"
  | "horarios"
  | "empresa"
  | "snapshot";

export default function StockTerminal() {
  const pathname = usePathname();
  const [selectedStock, setSelectedStock] = useState<
    string | { symbol: string }
  >(() => {
    if (pathname && pathname !== "/") {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length > 0) return parts[0].toUpperCase();
    }
    return "AAPL";
  });
  const [activeTab, setActiveTab] = useState<TabKey>("empresa");

  // Filter State
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [selectedSector, setSelectedSector] = useState("Technology");
  const [selectedIndustry, setSelectedIndustry] = useState("");

  const { countries, sectors, industries } = useFilterOptions(
    selectedCountry,
    selectedSector,
  );

  // Automatically select the first industry when the list changes or is loaded
  useEffect(() => {
    if (industries && industries.length > 0) {
      const isSelectedInList = industries.some(ind => (typeof ind === 'object' ? ind.value : ind) === selectedIndustry);
      if (!isSelectedInList) {
        setSelectedIndustry(typeof industries[0] === 'object' ? industries[0].value : industries[0]);
      }
    } else if (selectedIndustry !== "") {
      setSelectedIndustry("");
    }
  }, [industries, selectedIndustry]);

  // símbolo actual (string) sin importar si selectedStock es string u objeto
  const selectedSymbol = useMemo(() => {
    if (typeof selectedStock === "string")
      return selectedStock.toUpperCase?.() || "";
    return (selectedStock?.symbol || "").toUpperCase();
  }, [selectedStock]);

  const handleTopStockClick = useCallback((symbol: string) => {
    setSelectedStock(symbol);
  }, []);

  return (
    <div className="h-screen w-full flex flex-col bg-[#0e0e0e] overflow-hidden">
      <Header
        countries={countries}
        sectors={sectors}
        selectedSector={selectedSector}
        onSectorChange={setSelectedSector}
        industries={industries}
        selectedIndustry={selectedIndustry}
        onIndustryChange={setSelectedIndustry}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        onStockSelect={handleTopStockClick}
      />

      {/* Contenedor principal responsivo - Ancho completo */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        {selectedStock && (
          <div className="space-y-1 md:space-y-1 h-full">
            {/* Layout principal responsivo: 3 Columnas (Left 25% - Center 35% - Right 40%) */}
            <div className="bg-[#0e0e0e] grid grid-cols-1 xl:grid-cols-[32fr_30fr_33fr] md:gap-2 items-start h-full pt-2 pl-2 pr-2">
              {/* Panel izquierdo */}
              <div className="w-full xl:w-auto flex flex-col gap-1 min-h-0 h-full border border-[#222] overflow-hidden">
                <LeftPanel
                  onStockSelect={handleTopStockClick}
                  selectedTicker={selectedSymbol}
                  sectors={sectors}
                  selectedSector={selectedSector}
                  industries={industries}
                  selectedIndustry={selectedIndustry}
                  selectedCountry={selectedCountry}
                />
              </div>

              {/* Panel Central */}
              <div className="w-full xl:w-auto h-full flex flex-col overflow-hidden border border-[#222] pb-1 gap-1">
                <CentralPanel
                  selectedTicker={selectedSymbol}
                  onStockSelect={handleTopStockClick}
                />
              </div>

              {/* Panel derecho */}
              <div className="w-full xl:w-auto h-full flex flex-col overflow-hidden border border-[#222] pb-1 gap-1">
                <div className="w-full h-full overflow-hidden">
                  <TabManager
                    requestedTicker={selectedSymbol}
                    onActiveTickerChange={handleTopStockClick}
                    onSectorChange={setSelectedSector}
                    onIndustryChange={setSelectedIndustry}
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
